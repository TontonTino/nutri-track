"""
Précision réelle de l'estimation du PB par la caméra, calculée à partir des dépistages enregistrés.

Chaque dépistage fait avec la caméra conserve, dans `mesures` (voir mobile/src/vision/mesureAssistee.ts côté app) :
  - pb                  : la valeur retenue par l'agent ;
  - pb_estime_vision    : l'estimation brute de la caméra ;
  - pb_source           : "vision_ai" ;
  - pb_statut_validation: "confirmee" ou "corrigee" ;
  - pb_methode_mesure   : méthode ayant produit l'estimation (ex. "pixels_zone_pose", "pixels_zone_fixe").

L'écart (pb - pb_estime_vision) n'est une VRAIE erreur que si `pb` vient d'une mesure indépendante au ruban. Si l'agent
se contente de confirmer ce que la caméra affiche, l'écart est nul par construction : voir docs/VALIDATION_VISION.md.
"""

from typing import Any, Dict, Iterable, Optional

SEUIL_SEVERE_PAR_DEFAUT = 115.0
SEUIL_MODERE_PAR_DEFAUT = 125.0

NOTE = (
    "L'écart n'est une erreur réelle que si la valeur retenue provient d'une mesure indépendante au ruban. "
    "Une simple confirmation de l'estimation donne un écart nul par construction. "
    "Protocole de validation : docs/VALIDATION_VISION.md."
)


def _est_nombre(valeur: Any) -> bool:
    return isinstance(valeur, (int, float)) and not isinstance(valeur, bool)


def categorie_pb(pb: float, seuil_severe: float, seuil_modere: float) -> int:
    """0 = normal, 1 = modéré, 2 = sévère (mêmes bornes que pipeline.py : sévère si pb < seuil_severe)."""
    if pb < seuil_severe:
        return 2
    if pb < seuil_modere:
        return 1
    return 0


def _resume(ecarts: list, categories: list, n_confirmees: int, n_corrigees: int) -> Dict[str, Any]:
    n = len(ecarts)
    if n == 0:
        return {"n_mesures": 0}
    absolus = [abs(e) for e in ecarts]
    moins_graves = sum(1 for est, ret in categories if est < ret)
    differentes = sum(1 for est, ret in categories if est != ret)
    return {
        "n_mesures": n,
        "n_confirmees": n_confirmees,
        "n_corrigees": n_corrigees,
        "ecart_absolu_moyen_mm": round(sum(absolus) / n, 1),
        # Positif : la valeur retenue est plus grande que l'estimation (la caméra sous-estime le PB).
        "biais_moyen_mm": round(sum(ecarts) / n, 1),
        "part_dans_5_mm": round(sum(1 for a in absolus if a <= 5) / n, 2),
        "part_dans_10_mm": round(sum(1 for a in absolus if a <= 10) / n, 2),
        "part_categorie_differente": round(differentes / n, 2),
        # Le cas le plus grave : la caméra classe l'enfant MOINS gravement que la valeur retenue (enfant potentiellement manqué).
        "n_estimation_moins_grave_que_retenu": moins_graves,
    }


def calculer_precision(
    liste_mesures: Iterable[Any],
    seuil_severe: Optional[float] = None,
    seuil_modere: Optional[float] = None,
) -> Dict[str, Any]:
    seuil_severe = SEUIL_SEVERE_PAR_DEFAUT if seuil_severe is None else seuil_severe
    seuil_modere = SEUIL_MODERE_PAR_DEFAUT if seuil_modere is None else seuil_modere

    ecarts, categories = [], []
    n_confirmees = n_corrigees = 0
    par_methode: Dict[str, Dict[str, list]] = {}

    for mesures in liste_mesures:
        if not isinstance(mesures, dict) or mesures.get("pb_source") != "vision_ai":
            continue
        estime, retenu = mesures.get("pb_estime_vision"), mesures.get("pb")
        if not _est_nombre(estime) or not _est_nombre(retenu):
            continue

        ecart = float(retenu) - float(estime)
        cat = (
            categorie_pb(float(estime), seuil_severe, seuil_modere),
            categorie_pb(float(retenu), seuil_severe, seuil_modere),
        )
        ecarts.append(ecart)
        categories.append(cat)

        statut = mesures.get("pb_statut_validation")
        if statut == "corrigee":
            n_corrigees += 1
        elif statut == "confirmee":
            n_confirmees += 1

        methode = mesures.get("pb_methode_mesure") or "inconnue"
        groupe = par_methode.setdefault(str(methode), {"ecarts": [], "categories": [], "conf": [0], "corr": [0]})
        groupe["ecarts"].append(ecart)
        groupe["categories"].append(cat)
        if statut == "corrigee":
            groupe["corr"][0] += 1
        elif statut == "confirmee":
            groupe["conf"][0] += 1

    resultat = _resume(ecarts, categories, n_confirmees, n_corrigees)
    resultat["par_methode"] = {
        nom: _resume(g["ecarts"], g["categories"], g["conf"][0], g["corr"][0]) for nom, g in par_methode.items()
    }
    resultat["seuils_utilises_mm"] = {"severe": seuil_severe, "modere": seuil_modere}
    resultat["note"] = NOTE
    return resultat
