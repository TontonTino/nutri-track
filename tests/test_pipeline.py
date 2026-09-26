import pytest
from app.pipeline import (
    run_pipeline,
    valider_mesures_physiologiques,
    OutOfRangeError
)

# Seuils de test configurés
DEFAULT_SEUILS = {
    "pb_severe": 115.0,
    "pb_modere": 125.0,
    "score_mna_sf_denutrition": 7.0,
    "ecart_hu_max": 3.0
}

def test_enfant_pb_severe():
    """TEST: PB = 112 mm (enfant) -> classification 'sévère' et orientation déclenchée"""
    mesures = {"pb": 112.0, "oedemes_bilateraux": False}
    res = run_pipeline("enfant", mesures, DEFAULT_SEUILS)
    
    assert res["classification"] == "sévère"
    assert res["orientation_declenchee"] is True
    assert res["orientation"]["priorite"] == "Urgente"


def test_personne_agee_mna_sf_6():
    """TEST: MNA-SF = 6 -> 'dénutrition probable' et orientation déclenchée"""
    mesures = {"score_mna_sf": 6}
    res = run_pipeline("personne_agee", mesures, DEFAULT_SEUILS)

    assert res["classification"] == "dénutrition probable"
    assert res["orientation_declenchee"] is True


def test_femme_enceinte_hauteur_uterine_hors_fourchette():
    """TEST: Hauteur utérine hors fourchette -> alerte suivi rapproché, JAMAIS un diagnostic"""
    # Exemple: 28 SA, mais HU = 22 cm (écart = 6 cm > tolérance 3 cm)
    mesures = {
        "hauteur_uterine": 22.0,
        "semaine_amenorrhee": 28
    }
    res = run_pipeline("enceinte", mesures, DEFAULT_SEUILS)

    assert res["classification"] == "ecart_suivi_rapproche"
    assert res["orientation_declenchee"] is True
    # Vérification stricte: le message indique suivi rapproché et NE contient PAS le mot "diagnostic"
    msg = res["classification_detail"]["message"]
    assert "Écart observé par rapport à la référence — suivi rapproché recommandé" in msg
    assert "diagnostic" not in msg.lower()


def test_valeur_hors_plage_physiologique_rejetee():
    """TEST: Valeur hors plage physiologique -> rejetée avec OutOfRangeError"""
    # PB enfant = 10 mm (physiologiquement impossible, min 50 mm)
    mesures_aberrantes = {"pb": 10.0}

    with pytest.raises(OutOfRangeError) as exc_info:
        run_pipeline("enfant", mesures_aberrantes, DEFAULT_SEUILS)

    assert "hors de la plage physiologique" in str(exc_info.value)


def test_mna_sf_hors_plage():
    """TEST: Score MNA-SF = 20 (hors 0-14) -> rejeté"""
    mesures = {"score_mna_sf": 20}
    with pytest.raises(OutOfRangeError):
        run_pipeline("personne_agee", mesures, DEFAULT_SEUILS)
