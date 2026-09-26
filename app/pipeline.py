"""
NUTRI-DÉPIST Classification Engine & Pipeline
Pipeline en 4 étapes séparées :
1. Validation Physiologique (Mesure)
2. Interprétation (avec seuils configurables)
3. Classification (un seul indicateur sévère suffit, pas de moyenne)
4. Orientation (statut sévère déclenche toujours une orientation)
"""

class OutOfRangeError(ValueError):
    """Exception levée lorsqu'une mesure est hors plage physiologique."""
    pass


# Plages physiologiques strictes (Détection d'erreurs de saisie / capteurs)
PHYSIOLOGICAL_RANGES = {
    "enfant": {
        "pb": (50.0, 350.0),       # mm (ex: 112 mm est valide, <50 ou >350 est aberrent)
        "poids": (1.5, 35.0),     # kg
        "taille": (30.0, 150.0),   # cm
    },
    "personne_agee": {
        "score_mna_sf": (0, 14),   # Entier entre 0 et 14
        "perimetre_mollet": (10.0, 60.0), # cm
        "pb_optionnel": (100.0, 450.0),   # mm
    },
    "enceinte": {
        "hauteur_uterine": (5.0, 50.0),     # cm
        "semaine_amenorrhee": (4, 45),       # SA
        "pb": (100.0, 450.0),                # mm
    }
}


def valider_mesures_physiologiques(population: str, mesures: dict) -> None:
    """
    Étape 1: Validation Physiologique
    Lève OutOfRangeError si une valeur est hors plage physiologique.
    """
    if population not in PHYSIOLOGICAL_RANGES:
        raise OutOfRangeError(f"Population non reconnue: '{population}'")

    ranges = PHYSIOLOGICAL_RANGES[population]

    for key, val in mesures.items():
        if val is None:
            continue
        if key in ranges:
            min_val, max_val = ranges[key]
            if not (min_val <= val <= max_val):
                raise OutOfRangeError(
                    f"La mesure '{key}' ({val}) est hors de la plage physiologique valide [{min_val}, {max_val}]. Nouvelle mesure demandée."
                )


def interpreter_indicateurs(population: str, mesures: dict, seuils: dict) -> dict:
    """
    Étape 2: Interprétation
    Évalue les mesures par rapport aux seuils de configuration.
    seuils dict key example: 'pb_severe', 'score_mna_sf_denutrition', 'ecart_hu_max'
    """
    interpretation = {}

    if population == "enfant":
        pb = mesures.get("pb")
        oedemes = mesures.get("oedemes_bilateraux", False)
        pb_seuil_severe = seuils.get("pb_severe", 115.0)
        pb_seuil_modere = seuils.get("pb_modere", 125.0)

        is_severe = False
        is_modere = False

        if pb is not None and pb < pb_seuil_severe:
            is_severe = True
        if oedemes is True:
            is_severe = True
        
        if not is_severe and pb is not None and (pb_seuil_severe <= pb < pb_seuil_modere):
            is_modere = True

        interpretation["is_severe"] = is_severe
        interpretation["is_modere"] = is_modere
        interpretation["pb_estimé"] = pb

    elif population == "personne_agee":
        score = mesures.get("score_mna_sf")
        score_seuil = seuils.get("score_mna_sf_denutrition", 7.0)
        
        # MNA-SF <= 7 (et spécifiquement 6) indique dénutrition probable
        is_denutrition = (score is not None and score <= score_seuil)
        interpretation["is_denutrition_probable"] = is_denutrition
        interpretation["score_mna_sf"] = score

    elif population == "enceinte":
        hu = mesures.get("hauteur_uterine")
        sa = mesures.get("semaine_amenorrhee")
        tolerance = seuils.get("ecart_hu_max", 3.0)

        # Règle usuelle : HU ≈ SA entre 20 et 34 semaines d'aménorrhée
        hu_attendue = float(sa) if sa is not None else None
        ecart = abs(hu - hu_attendue) if (hu is not None and hu_attendue is not None) else 0.0

        interpretation["hauteur_uterine"] = hu
        interpretation["semaine_amenorrhee"] = sa
        interpretation["hauteur_uterine_attendue"] = hu_attendue
        interpretation["ecart_croissance_foetale"] = ecart
        interpretation["ecart_hors_tolerance"] = (ecart > tolerance)

    return interpretation


def classer_depistage(population: str, interpretation: dict) -> dict:
    """
    Étape 3: Classification
    Un seul indicateur au niveau sévère suffit à classer sévère (aucune moyenne).
    Femme enceinte : JAMAIS un diagnostic, uniquement alerte écart observé.
    """
    if population == "enfant":
        if interpretation.get("is_severe"):
            return {
                "classification": "sévère",
                "code": "MAS",  # Malnutrition Aiguë Sévère
                "detail": "Critère de gravité atteint (PB < seuil ou œdèmes)"
            }
        elif interpretation.get("is_modere"):
            return {
                "classification": "modéré",
                "code": "MAM",
                "detail": "Malnutrition aiguë modérée"
            }
        else:
            return {
                "classification": "normal",
                "code": "OK",
                "detail": "État nutritionnel normal"
            }

    elif population == "personne_agee":
        if interpretation.get("is_denutrition_probable"):
            return {
                "classification": "dénutrition probable",
                "code": "DENUTRITION_RISK",
                "detail": f"Score MNA-SF = {interpretation.get('score_mna_sf')}"
            }
        else:
            return {
                "classification": "satisfaisant",
                "code": "OK",
                "detail": "Score MNA-SF satisfaisant"
            }

    elif population == "enceinte":
        if interpretation.get("ecart_hors_tolerance"):
            # RÈGLE STRUCTURANTE: JAMAIS un diagnostic !
            return {
                "classification": "ecart_suivi_rapproche",
                "code": "SUIVI_RAPPROCHE",
                "message": "Écart observé par rapport à la référence — suivi rapproché recommandé",
                "detail": f"HU ({interpretation.get('hauteur_uterine')} cm) vs SA ({interpretation.get('semaine_amenorrhee')} SA), écart de {interpretation.get('ecart_croissance_foetale')} cm"
            }
        else:
            return {
                "classification": "normal",
                "code": "OK",
                "message": "Hauteur utérine conforme pour la semaine d'aménorrhée",
                "detail": "Croissance utérine dans la fourchette de référence"
            }

    return {"classification": "inconnu", "code": "UNKNOWN", "detail": "Population non reconnue"}


def determiner_orientation(classification_result: dict) -> dict:
    """
    Étape 4: Orientation
    Un statut 'sévère', 'dénutrition probable' ou 'ecart_suivi_rapproche' déclenche TOUJOURS une orientation.
    Jamais une simple suggestion alimentaire pour les cas sévères/à risque.
    """
    code = classification_result.get("code")
    classification = classification_result.get("classification")

    if classification in ["sévère", "dénutrition probable", "ecart_suivi_rapproche"] or code in ["MAS", "DENUTRITION_RISK", "SUIVI_RAPPROCHE"]:
        return {
            "orientation_declenchee": True,
            "centre_orientation": "Centre de Santé de Référence / Unité de Prise en Charge Nutritionnelle",
            "priorite": "Urgente",
            "recommandation": "Transfert immédiat pour prise en charge médicale et nutritionnelle spécialisée."
        }
    elif classification == "modéré":
        return {
            "orientation_declenchee": True,
            "centre_orientation": "Centre de Santé Communautaire",
            "priorite": "Modérée",
            "recommandation": "Supplémentation nutritionnelle et suivi hebdomadaire."
        }
    else:
        return {
            "orientation_declenchee": False,
            "centre_orientation": None,
            "priorite": "Aucune",
            "recommandation": "Conseils nutritionnels préventifs et suivi communautaire habituel."
        }


def run_pipeline(population: str, mesures: dict, seuils: dict) -> dict:
    """
    Moteur de classification complet exécutant les 4 étapes pures.
    """
    # 1. Validation physiologique
    valider_mesures_physiologiques(population, mesures)

    # 2. Interprétation
    interpretation = interpreter_indicateurs(population, mesures, seuils)

    # 3. Classification
    classification_res = classer_depistage(population, interpretation)

    # 4. Orientation
    orientation_res = determiner_orientation(classification_res)

    return {
        "interpretation": interpretation,
        "classification": classification_res["classification"],
        "classification_detail": classification_res,
        "orientation_declenchee": orientation_res["orientation_declenchee"],
        "orientation": orientation_res
    }
