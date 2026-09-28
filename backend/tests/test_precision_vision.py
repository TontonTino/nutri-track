import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.precision_vision import calculer_precision, categorie_pb

# La base de test (moteur partagé, tables et seuils par défaut) est fournie par la fixture autouse de conftest.py.
client = TestClient(app)


def vision(estime, retenu, statut="corrigee", methode="pixels_zone_fixe"):
    return {
        "pb": retenu,
        "pb_source": "vision_ai",
        "pb_estime_vision": estime,
        "pb_statut_validation": statut,
        "pb_methode_mesure": methode,
    }


class TestCategorie:
    def test_bornes_identiques_a_la_pipeline(self):
        assert categorie_pb(114.9, 115, 125) == 2  # sévère si < 115
        assert categorie_pb(115.0, 115, 125) == 1  # modéré à partir de 115
        assert categorie_pb(124.9, 115, 125) == 1
        assert categorie_pb(125.0, 115, 125) == 0  # normal à partir de 125


class TestCalculerPrecision:
    def test_aucune_mesure_vision(self):
        r = calculer_precision([{"pb": 120, "pb_source": "manuel"}])
        assert r["n_mesures"] == 0
        assert "note" in r

    def test_ecart_moyen_biais_et_parts(self):
        r = calculer_precision([vision(120, 110), vision(130, 128), vision(100, 100, statut="confirmee")])
        assert r["n_mesures"] == 3
        assert r["n_corrigees"] == 2 and r["n_confirmees"] == 1
        assert r["ecart_absolu_moyen_mm"] == pytest.approx(4.0)  # (10 + 2 + 0) / 3
        assert r["biais_moyen_mm"] == pytest.approx(-4.0)  # (-10 - 2 + 0) / 3 : la caméra surestime
        assert r["part_dans_5_mm"] == pytest.approx(0.67)
        assert r["part_dans_10_mm"] == 1.0

    def test_compte_les_enfants_potentiellement_manques(self):
        # Caméra : 122 (modéré). Valeur retenue : 112 (sévère) -> la caméra a sous-classé l'enfant.
        r = calculer_precision([vision(122, 112), vision(112, 122)])
        assert r["n_estimation_moins_grave_que_retenu"] == 1
        assert r["part_categorie_differente"] == 1.0

    def test_ventile_par_methode(self):
        r = calculer_precision([
            vision(120, 118, methode="pixels_zone_pose"),
            vision(120, 100, methode="pixels_zone_fixe"),
        ])
        assert r["par_methode"]["pixels_zone_pose"]["ecart_absolu_moyen_mm"] == pytest.approx(2.0)
        assert r["par_methode"]["pixels_zone_fixe"]["ecart_absolu_moyen_mm"] == pytest.approx(20.0)

    def test_ignore_les_enregistrements_incomplets_ou_mal_types(self):
        r = calculer_precision([
            None,
            "texte",
            {"pb_source": "vision_ai", "pb": 110},                          # pas d'estimation
            {"pb_source": "vision_ai", "pb_estime_vision": None, "pb": 110},
            {"pb_source": "vision_ai", "pb_estime_vision": True, "pb": 110},  # booléen refusé
            vision(120, 118),
        ])
        assert r["n_mesures"] == 1

    def test_seuils_personnalises(self):
        # Avec un seuil sévère relevé à 130, 120 -> retenu 128 change de catégorie (les deux sont sévères) : pas de changement
        r = calculer_precision([vision(132, 128)], seuil_severe=130, seuil_modere=140)
        assert r["part_categorie_differente"] == 1.0  # 132 modéré, 128 sévère
        assert r["n_estimation_moins_grave_que_retenu"] == 1


class TestEndpoint:
    def _poster(self, mesures):
        res = client.post("/depistage", json={
            "population": "enfant", "mesures": mesures, "agent_id": "T", "centre_id": "C", "mode_saisie": "vision",
        })
        assert res.status_code == 201, res.text

    def test_vide(self):
        res = client.get("/statistiques/vision")
        assert res.status_code == 200
        assert res.json()["n_mesures"] == 0

    def test_agrege_les_depistages_vision_enregistres(self):
        self._poster({**vision(122, 112), "oedemes_bilateraux": False})
        self._poster({"pb": 118.0, "pb_source": "manuel", "oedemes_bilateraux": False})  # ignoré
        res = client.get("/statistiques/vision")
        assert res.status_code == 200
        data = res.json()
        assert data["n_mesures"] == 1
        assert data["ecart_absolu_moyen_mm"] == 10.0
        assert data["n_estimation_moins_grave_que_retenu"] == 1
        assert data["seuils_utilises_mm"] == {"severe": 115.0, "modere": 125.0}
