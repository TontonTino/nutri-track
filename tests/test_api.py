import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

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
        "mesures": {"pb": 10.0},  # Impossibilité physiologique
        "agent_id": "AGENT_01",
        "centre_id": "CENTRE_A",
        "mode_saisie": "manuel"
    }
    response = client.post("/depistage", json=payload)
    assert response.status_code == 422
    assert "Erreur de mesure" in response.json()["detail"]


def test_get_depistage_by_id():
    # 1. Créer un dépistage
    payload = {
        "population": "personne_agee",
        "mesures": {"score_mna_sf": 6},
        "agent_id": "AGENT_02",
        "centre_id": "CENTRE_B"
    }
    post_res = client.post("/depistage", json=payload)
    dep_id = post_res.json()["id"]

    # 2. Récupérer via GET
    get_res = client.get(f"/depistage/{dep_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == dep_id


def test_get_alertes():
    # 1. Créer un cas sévère
    client.post("/depistage", json={
        "population": "enfant",
        "mesures": {"pb": 110.0},
        "agent_id": "AGENT_01",
        "centre_id": "CENTRE_A"
    })
    
    # 2. Récupérer alertes
    res = client.get("/alertes")
    assert res.status_code == 200
    alertes = res.json()
    assert len(alertes) >= 1
    assert alertes[0]["orientation_declenchee"] is True


def test_get_and_put_seuils():
    # GET /seuils
    get_res = client.get("/seuils")
    assert get_res.status_code == 200
    seuils = get_res.json()
    assert len(seuils) >= 4

    # PUT /seuils - Modifier le seuil PB sévère de 115 à 110
    update_payload = {
        "population": "enfant",
        "type_mesure": "pb_severe",
        "nouvelle_valeur": 110.0,
        "agent_id": "SUPERVISEUR_01",
        "version_protocole": "OMS 2025"
    }
    put_res = client.put("/seuils", json=update_payload)
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["valeur_seuil"] == 110.0

    # Vérifier que le nouveau dépistage utilise le nouveau seuil (112 mm n'est plus sévère si seuil = 110 mm)
    dep_payload = {
        "population": "enfant",
        "mesures": {"pb": 112.0},
        "agent_id": "AGENT_01",
        "centre_id": "CENTRE_A"
    }
    dep_res = client.post("/depistage", json=dep_payload)
    assert dep_res.json()["classification"] == "modéré"  # Car 110 <= 112 < 125
