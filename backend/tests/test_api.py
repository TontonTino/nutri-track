import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# S'assurer que le dossier parent (backend/) est dans le sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import Base, get_db
from app.main import app, seed_default_seuils
from app import models

# Engine SQLite en mémoire partagée via StaticPool
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_default_seuils(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


def test_health_check_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert "uptime_seconds" in data


def test_post_depistage_enfant_severe():
    payload = {
        "population": "enfant",
        "mesures": {"pb": 112.0, "oedemes_bilateraux": False},
        "agent_id": "AGENT_01",
        "centre_id": "CENTRE_A",
        "mode_saisie": "manuel"
    }
    response = client.post("/depistage", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["classification"] == "sévère"
    assert data["orientation_declenchee"] is True
    assert data["id"] is not None


def test_capture_vision_and_validation():
    """TEST: Capture Vision AI -> Validation par l'ASC -> Création Dépistage Officiel"""
    # 1. Capture Vision AI (Lionel/Vision)
    capture_payload = {
        "population": "enfant",
        "type_mesure": "pb",
        "valeur_estimee": 112.0,
        "score_confiance": 0.96,
        "agent_id": "LIONEL_VISION",
        "centre_id": "CENTRE_A",
        "image_metadata": {"filename": "muac_test_01.jpg"}
    }
    capture_res = client.post("/capture-vision", json=capture_payload)
    assert capture_res.status_code == 201
    capture_data = capture_res.json()
    assert capture_data["statut_validation"] == "en_attente"
    capture_id = capture_data["id"]

    # 2. Validation par l'ASC
    validation_payload = {
        "valeur_validee": 112.0,
        "statut_validation": "valide",
        "agent_id": "ASC_COMMUNAUTAIRE_01",
        "oedemes_bilateraux": False
    }
    val_res = client.post(f"/capture-vision/{capture_id}/validation", json=validation_payload)
    assert val_res.status_code == 200
    dep_data = val_res.json()
    assert dep_data["classification"] == "sévère"
    assert dep_data["orientation_declenchee"] is True
    assert dep_data["mode_saisie"] == "ocr_photo"


def test_post_depistage_personne_agee():
    payload = {
        "population": "personne_agee",
        "mesures": {"score_mna_sf": 6},
        "agent_id": "AGENT_02",
        "centre_id": "CENTRE_B",
        "mode_saisie": "manuel"
    }
    response = client.post("/depistage", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["classification"] == "dénutrition probable"
    assert data["orientation_declenchee"] is True


def test_post_depistage_enceinte_ecart():
    payload = {
        "population": "enceinte",
        "mesures": {
            "personne_id": "FEMME_123",
            "hauteur_uterine": 22.0,
            "semaine_amenorrhee": 28
        },
        "agent_id": "AGENT_03",
        "centre_id": "CENTRE_A",
        "mode_saisie": "mètre_ruban"
    }
    response = client.post("/depistage", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["classification"] == "ecart_suivi_rapproche"
    assert "suivi rapproché" in data["message"]
    assert "diagnostic" not in data["message"].lower()


def test_post_depistage_valeur_hors_plage_rejetee():
    payload = {
        "population": "enfant",
        "mesures": {"pb": 10.0},
        "agent_id": "AGENT_01",
        "centre_id": "CENTRE_A",
        "mode_saisie": "manuel"
    }
    response = client.post("/depistage", json=payload)
    assert response.status_code == 422
    assert "Erreur de mesure" in response.json()["detail"]


def test_get_depistage_by_id():
    payload = {
        "population": "personne_agee",
        "mesures": {"score_mna_sf": 6},
        "agent_id": "AGENT_02",
        "centre_id": "CENTRE_B"
    }
    post_res = client.post("/depistage", json=payload)
    dep_id = post_res.json()["id"]

    get_res = client.get(f"/depistage/{dep_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == dep_id


def test_get_alertes():
    client.post("/depistage", json={
        "population": "enfant",
        "mesures": {"pb": 110.0},
        "agent_id": "AGENT_01",
        "centre_id": "CENTRE_A"
    })
    
    res = client.get("/alertes")
    assert res.status_code == 200
    alertes = res.json()
    assert len(alertes) >= 1
    assert alertes[0]["orientation_declenchee"] is True


def test_get_and_put_seuils():
    get_res = client.get("/seuils")
    assert get_res.status_code == 200
    seuils = get_res.json()
    assert len(seuils) >= 4

    update_payload = {
        "population": "enfant",
        "type_mesure": "pb_severe",
        "nouvelle_valeur": 110.0,
        "agent_id": "SUPERVISEUR_01",
        "version_protocole": "PCIMA Burkina Faso 2014"
    }
    put_res = client.put("/seuils", json=update_payload)
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["valeur_seuil"] == 110.0


def test_export_csv_and_fiche_orientation():
    post_res = client.post("/depistage", json={
        "population": "enfant",
        "mesures": {"pb": 110.0},
        "agent_id": "AGENT_01",
        "centre_id": "CENTRE_A"
    })
    dep_id = post_res.json()["id"]

    csv_res = client.get("/alertes/export/csv")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert "Classification" in csv_res.text

    fiche_res = client.get(f"/alertes/{dep_id}/fiche-orientation")
    assert fiche_res.status_code == 200
    assert "text/html" in fiche_res.headers["content-type"]
    assert "FICHE DE TRANSFERT PCIMA" in fiche_res.text


def test_fanta_mobile_payloads_and_vision_compatibility():
    """Test compatibility with Fanta's mobile payloads and Lionel's Vision API payloads."""
    # 1. Enfant depistage with Fanta's photo control metadata
    payload_fanta = {
        "population": "enfant",
        "mesures": {
            "pb": 120.0,
            "pb_source": "manuel",
            "poids": 9.5,
            "taille": 82.0,
            "oedemes_bilateraux": False,
            "oedemes_source": "clinique",
            "pb_controle_photo": "coherent",
            "pb_couleur_detectee": "jaune"
        },
        "agent_id": "FANTA_ASC",
        "centre_id": "CSPS_Kari",
        "mode_saisie": "manuel"
    }
    res = client.post("/depistage", json=payload_fanta)
    assert res.status_code == 201
    data = res.json()
    assert data["classification"] == "modéré"
    assert data["mesures"]["pb_controle_photo"] == "coherent"

    # 2. Vision capture without calibration (valeur_estimee null, image_ref provided)
    capture_payload = {
        "type_mesure": "pb",
        "valeur_estimee": None,
        "image_ref": "file:///cache/photo.jpg",
        "score_qualite": 0.88,
        "methode_mesure": "heuristique_calibration"
    }
    cap_res = client.post("/capture-vision", json=capture_payload)
    assert cap_res.status_code == 201
    cap_data = cap_res.json()
    assert cap_data["statut_validation"] == "en_attente"

    # 3. Vision validation with mobile aliases (statut and agent_validation_id)
    val_payload = {
        "valeur_validee": 105.0,
        "statut": "confirmee",
        "agent_validation_id": "FANTA_ASC",
        "oedemes_bilateraux": False
    }
    val_res = client.put(f"/capture-vision/{cap_data['id']}/validation", json=val_payload)
    assert val_res.status_code == 200
    val_data = val_res.json()
    assert val_data["classification"] == "sévère"

