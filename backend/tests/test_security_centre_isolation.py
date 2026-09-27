"""
VOLET 2 — Sécurité basique : un compte agent ne doit pas pouvoir consulter les
données d'un autre centre de santé.

⚠️ CONSTAT (Rasmata, 2026-09-26) : à ce jour, `app/main.py` (branche
`alya/engine-api`) n'a AUCUN contrôle d'accès — ni authentification, ni
vérification de `centre_id` — sur `GET /depistage/{id}` (ni sur `GET /alertes`,
qui liste tout, tous centres confondus). N'importe quel agent connu peut donc lire
les dépistages de n'importe quel autre centre simplement en devinant/itérant les
ids. C'est un critère de démo explicite : à corriger AVANT le jury, en priorité
juste après le Volet 1.

Ces tests documentent le comportement ATTENDU (isolation par centre via un header
`X-Centre-Id` porté par l'agent connecté) et échoueront tant que la vérification
n'est pas ajoutée côté backend. Proposition minimale à valider avec Alya avant de
toucher `app/main.py` (elle est propriétaire de ce fichier) :

    from fastapi import Header

    def get_centre_agent(x_centre_id: str = Header(...)) -> str:
        return x_centre_id

    @app.get("/depistage/{id}", response_model=schemas.DepistageResponse, tags=["Dépistages"])
    def obtenir_depistage(id: int, centre_agent: str = Depends(get_centre_agent), db: Session = Depends(get_db)):
        depistage = db.query(models.Depistage).filter(models.Depistage.id == id).first()
        if not depistage:
            raise HTTPException(status_code=404, detail="Dépistage introuvable")
        if depistage.centre_id != centre_agent:
            raise HTTPException(status_code=403, detail="Accès refusé : centre différent")
        return depistage

Ce n'est volontairement pas une vraie authentification (pas de temps pour ça en
2 jours) — juste la vérification minimale qui satisfait le critère de démo.
À placer dans backend/tests/ une fois fusionné avec la branche d'Alya (ce test
importe `app.main`, qui n'existe que sur `alya/engine-api`).
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

# La base de test et l'override de get_db sont gérés par conftest.py
# (fixture autouse `base_de_test_partagee`), partagée avec test_api.py.
client = TestClient(app)


def _creer_depistage(centre_id, agent_id="AGENT_A"):
    payload = {
        "population": "enfant",
        "mesures": {"pb": 110.0},
        "agent_id": agent_id,
        "centre_id": centre_id,
        "mode_saisie": "manuel",
    }
    res = client.post("/depistage", json=payload)
    assert res.status_code == 201
    return res.json()["id"]


@pytest.mark.xfail(
    reason="Isolation par centre pas encore implémentée dans app/main.py — voir docstring du fichier.",
    strict=False,
)
def test_un_agent_ne_peut_pas_lire_le_depistage_dun_autre_centre():
    dep_id = _creer_depistage(centre_id="CENTRE_A")

    res = client.get(f"/depistage/{dep_id}", headers={"X-Centre-Id": "CENTRE_B"})

    assert res.status_code == 403, (
        "Un agent du CENTRE_B a pu lire un dépistage du CENTRE_A : "
        "fuite de données inter-centres à corriger avant la démo."
    )


@pytest.mark.xfail(
    reason="Isolation par centre pas encore implémentée dans app/main.py — voir docstring du fichier.",
    strict=False,
)
def test_un_agent_du_meme_centre_peut_lire_le_depistage():
    dep_id = _creer_depistage(centre_id="CENTRE_A")

    res = client.get(f"/depistage/{dep_id}", headers={"X-Centre-Id": "CENTRE_A"})

    assert res.status_code == 200
    assert res.json()["centre_id"] == "CENTRE_A"
