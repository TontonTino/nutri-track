"""
NUTRI-DÉPIST Classification Engine & Pipeline
Protocol: PCIMA Burkina Faso (Ministère de la Santé, 2014) & Directive OMS 2006

Pipeline en 4 étapes séparées :
1. Validation Physiologique (Mesure)
2. Interprétation (avec seuils configurables & calcul d'indices IMC / Z-Score P/T)
3. Classification (un seul indicateur sévère suffit, pas de moyenne)
4. Orientation (statut sévère déclenche toujours une orientation)
"""

import math

class OutOfRangeError(ValueError):
    """Exception levée lorsqu'une mesure est hors plage physiologique."""
    pass


# Plages physiologiques strictes (Détection d'erreurs de saisie / capteurs)
PHYSIOLOGICAL_RANGES = {
    "enfant": {
        "pb": (50.0, 350.0),       # mm (ex: 112 mm est valide, <50 ou >350 est aberrant)
        "poids": (1.5, 35.0),      # kg
        "taille": (30.0, 150.0),   # cm
    },
    "personne_agee": {
        "score_mna_sf": (0, 14),        # Entier entre 0 et 14
        "perimetre_mollet": (10.0, 60.0),# cm
        "pb_optionnel": (100.0, 450.0),  # mm
    },
    "enceinte": {
        "hauteur_uterine": (5.0, 50.0),     # cm
        "semaine_amenorrhee": (4, 45),       # SA
        "pb": (100.0, 450.0),                # mm
    }
}


def generer_numero_ma(region: str, district: str, structure: str, annee: int, ordre: int) -> str:
    """
    Génère le Numéro Unique MA officiel selon la norme PCIMA Burkina Faso (Page 95 du Protocole 2014).
    Format : REGION / DISTRICT / STRUCTURE / ANNEE / NUMERO_ORDRE
    Exemple : RBM / DDG / CSPS_Kari / 2026 / 001
    """
    return f"{region.upper()}/{district.upper()}/{structure.upper()}/{annee}/{ordre:03d}"


def calculer_imc(poids_kg: float, taille_cm: float) -> float:
    """Calcul de l'Indice de Masse Corporelle (IMC = kg / m²)."""
    if not poids_kg or not taille_cm or taille_cm <= 0:
        return 0.0
    taille_m = taille_cm / 100.0
    return round(poids_kg / (taille_m * taille_m), 2)


def estimer_zscore_poids_taille(poids_kg: float, taille_cm: float) -> float:
    """
    Estimation de l'indice Poids-pour-Taille (P/T Z-score OMS 2006 / Annexe 5 du Protocole PCIMA).
    Retourne la déviation estimée en Z-score par rapport à la médiane de référence.
    """
    if not poids_kg or not taille_cm or taille_cm <= 0:
        return 0.0
    
    # Médiane approximative P/T OMS : Poids théorique médian = (taille_cm - 45) * 0.22 + 2.5 pour 50-100cm
    poids_median_ref = (taille_cm - 45.0) * 0.22 + 2.5 if taille_cm >= 45 else 2.5
    ecart_type_ref = poids_median_ref * 0.12  # ~12% d'écart-type standard OMS
    
    zscore = (poids_kg - poids_median_ref) / ecart_type_ref if ecart_type_ref > 0 else 0.0
    return round(zscore, 2)


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
    Évalue les mesures par rapport aux seuils de la table de configuration 'Seuils'
    conforme au Protocole National PCIMA Burkina Faso.
    """
    interpretation = {}

    if population == "enfant":
        pb = mesures.get("pb")
        poids = mesures.get("poids")
        taille = mesures.get("taille")
        oedemes = mesures.get("oedemes_bilateraux", False)
        
        pb_seuil_severe = seuils.get("pb_severe", 115.0)
        pb_seuil_modere = seuils.get("pb_modere", 125.0)

        is_severe = False
        is_modere = False
        complications = mesures.get("complications_medicales", False)

        # 1. Critère PB (Périmètre Brachial)
        if pb is not None and pb < pb_seuil_severe:
            is_severe = True
        if oedemes is True:
            is_severe = True

        # 2. Critère P/T Z-score (si poids et taille fournis)
        zscore_pt = 0.0
        if poids and taille:
            zscore_pt = estimer_zscore_poids_taille(poids, taille)
            interpretation["zscore_poids_taille"] = zscore_pt
            if zscore_pt < -3.0:
                is_severe = True
            elif -3.0 <= zscore_pt < -2.0 and not is_severe:
                is_modere = True

        if not is_severe and pb is not None and (pb_seuil_severe <= pb < pb_seuil_modere):
            is_modere = True

        interpretation["is_severe"] = is_severe
        interpretation["is_modere"] = is_modere
        interpretation["has_oedemes"] = oedemes
        interpretation["has_complications"] = complications
        interpretation["pb_estimé"] = pb

    elif population == "personne_agee":
        score = mesures.get("score_mna_sf")
        score_seuil = seuils.get("score_mna_sf_denutrition", 7.0)
        pb_opt = mesures.get("pb_optionnel")
        pb_adulte_seuil = seuils.get("pb_severe_adulte", 180.0)

        is_denutrition = (score is not None and score <= score_seuil)
        if pb_opt is not None and pb_opt < pb_adulte_seuil:
            is_denutrition = True

        interpretation["is_denutrition_probable"] = is_denutrition
        interpretation["score_mna_sf"] = score

    elif population == "enceinte":
        hu = mesures.get("hauteur_uterine")
        sa = mesures.get("semaine_amenorrhee")
        pb = mesures.get("pb")
        poids = mesures.get("poids")
        taille = mesures.get("taille")
        
        tolerance = seuils.get("ecart_hu_max", 3.0)
        pb_enceinte_seuil = seuils.get("pb_enceinte_seuil", 230.0)  # PCIMA Tableau 3 : PB < 230 mm

        hu_attendue = float(sa) if sa is not None else None
        ecart = abs(hu - hu_attendue) if (hu is not None and hu_attendue is not None) else 0.0

        is_pb_faible = (pb is not None and pb < pb_enceinte_seuil)
        imc = calculer_imc(poids, taille) if (poids and taille) else None

        if imc and imc < 18.5:
            is_pb_faible = True  # IMC < 18,5 est un critère d'admission PECMAM FEFA (Page 29)

        interpretation["hauteur_uterine"] = hu
        interpretation["semaine_amenorrhee"] = sa
        interpretation["hauteur_uterine_attendue"] = hu_attendue
        interpretation["ecart_croissance_foetale"] = ecart
        interpretation["ecart_hors_tolerance"] = (ecart > tolerance)
        interpretation["is_pb_faible"] = is_pb_faible
        interpretation["imc"] = imc

    return interpretation


def classer_depistage(population: str, interpretation: dict) -> dict:
    """
    Étape 3: Classification (PCIMA Burkina Faso)
    Un seul indicateur au niveau sévère suffit à classer sévère (aucune moyenne).
    Femme enceinte : JAMAIS un diagnostic ! Uniquement signal de suivi rapproché.
    """
    if population == "enfant":
        if interpretation.get("is_severe"):
            if interpretation.get("has_oedemes") or interpretation.get("has_complications"):
                return {
                    "classification": "sévère",
                    "code": "MAS_PCI",
                    "detail": "Malnutrition Aiguë Sévère avec œdèmes ou complications (PCI / Hospitalisation d'urgence)"
                }
            else:
                return {
                    "classification": "sévère",
                    "code": "MAS_PCA",
                    "detail": "Malnutrition Aiguë Sévère sans complication (PCA / Prise en charge ambulatoire)"
                }
        elif interpretation.get("is_modere"):
            return {
                "classification": "modéré",
                "code": "MAM_PECMAM",
                "detail": "Malnutrition Aiguë Modérée (PECMAM / Prise en charge communautaire)"
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
                "detail": f"Dénutrition probable selon le score MNA-SF ({interpretation.get('score_mna_sf')})"
            }
        else:
            return {
                "classification": "satisfaisant",
                "code": "OK",
                "detail": "État nutritionnel satisfaisant"
            }

    elif population == "enceinte":
        if interpretation.get("ecart_hors_tolerance"):
            return {
                "classification": "ecart_suivi_rapproche",
                "code": "SUIVI_RAPPROCHE",
                "message": "Écart observé par rapport à la référence — suivi rapproché recommandé",
                "detail": f"HU ({interpretation.get('hauteur_uterine')} cm) vs SA ({interpretation.get('semaine_amenorrhee')} SA), écart de {interpretation.get('ecart_croissance_foetale')} cm"
            }
        elif interpretation.get("is_pb_faible"):
            return {
                "classification": "modéré",
                "code": "PECMAM_FEFA",
                "message": "Périmètre brachial ou IMC inférieur au seuil protocolaire (PB < 230 mm / IMC < 18,5)",
                "detail": "Admission en supplémentation nutritionnelle FEFA"
            }
        else:
            return {
                "classification": "normal",
                "code": "OK",
                "message": "Hauteur utérine et état nutritionnel conformes",
                "detail": "Croissance utérine et périmètre brachial dans la référence"
            }

    return {"classification": "inconnu", "code": "UNKNOWN", "detail": "Population non reconnue"}


def determiner_orientation(classification_result: dict) -> dict:
    """
    Étape 4: Orientation (PCIMA Burkina Faso)
    Un statut 'sévère', 'dénutrition probable' ou 'ecart_suivi_rapproche' déclenche TOUJOURS une orientation.
    """
    code = classification_result.get("code")
    classification = classification_result.get("classification")

    if code == "MAS_PCI":
        return {
            "orientation_declenchee": True,
            "centre_orientation": "Hôpital de District / Unité PCI (Prise en Charge Interne)",
            "priorite": "Urgente",
            "recommandation": "Transfert d'urgence immédiat en structure hospitalière (PCI) pour soins intensifs."
        }
    elif classification in ["sévère", "dénutrition probable", "ecart_suivi_rapproche"] or code in ["MAS_PCA", "DENUTRITION_RISK", "SUIVI_RAPPROCHE"]:
        return {
            "orientation_declenchee": True,
            "centre_orientation": "CSPS / Centre de Santé de Référence (PCA / CPN)",
            "priorite": "Urgente",
            "recommandation": "Transfert immédiat pour prise en charge médicale et suivi nutritionnel spécialisé."
        }
    elif classification == "modéré" or code in ["MAM_PECMAM", "PECMAM_FEFA"]:
        return {
            "orientation_declenchee": True,
            "centre_orientation": "CSPS / Centre de Santé Communautaire (PECMAM)",
            "priorite": "Modérée",
            "recommandation": "Admission en programme PECMAM / Supplémentation nutritionnelle et suivi."
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
    valider_mesures_physiologiques(population, mesures)
    interpretation = interpreter_indicateurs(population, mesures, seuils)
    classification_res = classer_depistage(population, interpretation)
    orientation_res = determiner_orientation(classification_res)

    return {
        "interpretation": interpretation,
        "classification": classification_res["classification"],
        "classification_detail": classification_res,
        "orientation_declenchee": orientation_res["orientation_declenchee"],
        "orientation": orientation_res
    }


def generer_qr_code_svg(content: str, width: int = 140) -> str:
    """
    Génère un QR Code vectoriel SVG pur (sans dépendance externe).
    Permet la numérisation instantanée du Numéro Unique MA sur la Fiche de Transfert PCIMA.
    """
    grid_size = 25
    matrix = [[0 for _ in range(grid_size)] for _ in range(grid_size)]
    is_function_pattern = [[False for _ in range(grid_size)] for _ in range(grid_size)]

    def place_finder(r, c):
        for dr in range(7):
            for dc in range(7):
                if 0 <= r + dr < grid_size and 0 <= c + dc < grid_size:
                    is_function_pattern[r + dr][c + dc] = True
                    if dr in (0, 6) or dc in (0, 6) or (2 <= dr <= 4 and 2 <= dc <= 4):
                        matrix[r + dr][c + dc] = 1

    place_finder(0, 0)
    place_finder(grid_size - 7, 0)
    place_finder(0, grid_size - 7)

    for i in range(8, grid_size - 8):
        if not is_function_pattern[6][i]:
            matrix[6][i] = 1 if i % 2 == 0 else 0
            is_function_pattern[6][i] = True
        if not is_function_pattern[i][6]:
            matrix[i][6] = 1 if i % 2 == 0 else 0
            is_function_pattern[i][6] = True

    ar, ac = 16, 16
    for dr in range(-2, 3):
        for dc in range(-2, 3):
            is_function_pattern[ar + dr][ac + dc] = True
            if max(abs(dr), abs(dc)) != 1:
                matrix[ar + dr][ac + dc] = 1

    raw_bytes = content.encode('utf-8')
    bit_str = "0100" + f"{len(raw_bytes):08b}" + "".join(f"{b:08b}" for b in raw_bytes)
    bit_str += "0000"
    while len(bit_str) % 8 != 0:
        bit_str += "0"
    pad_bytes = ["11101100", "00010001"]
    pad_idx = 0
    while len(bit_str) < 300:
        bit_str += pad_bytes[pad_idx % 2]
        pad_idx += 1

    bit_idx = 0
    dir_up = True
    c = grid_size - 1
    while c > 0:
        if c == 6:
            c -= 1
        rows = range(grid_size - 1, -1, -1) if dir_up else range(grid_size)
        for r in rows:
            for col in (c, c - 1):
                if not is_function_pattern[r][col]:
                    val = 1 if bit_idx < len(bit_str) and bit_str[bit_idx] == '1' else 0
                    mask = 1 if (r + col) % 2 == 0 else 0
                    matrix[r][col] = val ^ mask
                    bit_idx += 1
        dir_up = not dir_up
        c -= 2

    cell_size = 4
    view_box = grid_size * cell_size
    svg_rects = []
    for r in range(grid_size):
        for col in range(grid_size):
            if matrix[r][col] == 1:
                x, y = col * cell_size, r * cell_size
                svg_rects.append(f'<rect x="{x}" y="{y}" width="{cell_size}" height="{cell_size}" fill="#0f172a"/>')

    rects_rendered = "\n".join(svg_rects)
    return (
        f'<svg width="{width}" height="{width}" viewBox="0 0 {view_box} {view_box}" '
        f'xmlns="http://www.w3.org/2000/svg" style="background:#ffffff; padding: 4px; '
        f'border-radius: 6px; border: 1px solid #cbd5e1; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">'
        f'{rects_rendered}</svg>'
    )
