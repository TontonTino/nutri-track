"""
NUTRI-TRACK - Moteur de Décision (PREDICT)
Fichier : core/decision_engine.py
Auteur : KIEMDE Alya (Logique Métier & Moteur de Décision)

Responsabilité :
- Calcul du Stock Mobilisable (Section 4.1)
- Calcul des Jours de Couverture Mobilisable - JCM (Section 4.2)
- Classification du niveau de risque (Section 4.3)
- Évaluation de la fraîcheur des données (Section 4, BF-05)
- Synthèse diagnostique d'un centre de santé

Architecture découplée : Aucune adhérence externe (pure standard library Python).
"""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional, Tuple

from core.models import (
    CenterStock,
    CenterDiagnosis,
    RiskLevel,
    FreshnessStatus,
)

# Paramètres de démonstration selon le Cahier des Charges (Section 4.3)
DEFAULT_THRESHOLD_STABLE_JCM: float = 14.0    # JCM >= 14 jours -> Stable
DEFAULT_THRESHOLD_RISK_JCM: float = 7.0        # JCM <= 7 jours -> Risque de rupture
DEFAULT_MAX_DATA_AGE_HOURS: float = 48.0      # Au-delà de 48h -> Donnée obsolète


def calculate_mobilizable_stock(
    physical_stock: int,
    reserved_stock: int,
    security_stock: int
) -> int:
    """
    Calcule le Stock Mobilisable selon la formule officielle du Cahier des Charges (Section 4.1) :
    Stock Mobilisable = Stock physique − Stock réservé estimé − Stock de sécurité

    Args:
        physical_stock: Stock total présent dans le centre (sachets ATPE)
        reserved_stock: Stock réservé pour les enfants déjà en file active de traitement
        security_stock: Stock tampon incompressible d'urgence

    Returns:
        int: Stock disponible pour une éventuelle mobilisation locale.
             Peut être négatif si le stock physique ne couvre même pas les réservations.
    """
    return int(physical_stock - reserved_stock - security_stock)


def calculate_jcm(
    mobilizable_stock: int,
    daily_consumption: float
) -> float:
    """
    Calcule les Jours de Couverture Mobilisable (JCM) (Section 4.2) :
    JCM = Stock Mobilisable ÷ consommation quotidienne observée

    Critères de robustesse métier :
    - Si la consommation est <= 0 :
        * Si stock mobilisable <= 0 -> 0.0 jour
        * Si stock mobilisable > 0 -> 999.0 jours (aucune consommation observée)
    - Si le stock mobilisable est <= 0 : retourne 0.0 jour de couverture.
    - Résultat arrondi à 1 décimale (ex: 11.8 jours).

    Args:
        mobilizable_stock: Quantité mobilisable calculée
        daily_consumption: Taux de consommation moyen en sachets/jour

    Returns:
        float: Nombre de jours de couverture mobilisable estimés
    """
    if daily_consumption <= 0:
        return 999.0 if mobilizable_stock > 0 else 0.0

    if mobilizable_stock <= 0:
        return 0.0

    jcm_val = mobilizable_stock / daily_consumption
    return round(jcm_val, 1)


def classify_risk(
    jcm: float,
    threshold_stable: float = DEFAULT_THRESHOLD_STABLE_JCM,
    threshold_risk: float = DEFAULT_THRESHOLD_RISK_JCM
) -> RiskLevel:
    """
    Classe le niveau de risque selon les seuils du Cahier des Charges (Section 4.3) :
    - Stable            : JCM >= 14 jours
    - Tension           : 7 jours < JCM < 14 jours
    - Risque de rupture : JCM <= 7 jours

    Args:
        jcm: Jours de Couverture Mobilisable
        threshold_stable: Seuil pour le statut Stable (défaut: 14.0)
        threshold_risk: Seuil pour le statut Risque de rupture (défaut: 7.0)

    Returns:
        RiskLevel: Énumération du statut de risque
    """
    if jcm >= threshold_stable:
        return RiskLevel.STABLE
    elif jcm > threshold_risk:
        return RiskLevel.TENSION
    else:
        return RiskLevel.RISK_OF_STOCKOUT


def evaluate_data_freshness(
    last_updated_at: datetime,
    max_age_hours: float = DEFAULT_MAX_DATA_AGE_HOURS,
    current_time: Optional[datetime] = None
) -> Tuple[FreshnessStatus, float]:
    """
    Évalue la fraîcheur de la donnée saisie par l'ASC (Section 4 & BF-05).
    Permet au MCD de savoir si l'indicateur repose sur une donnée récente ou obsolète.

    Args:
        last_updated_at: Date et heure du dernier enregistrement
        max_age_hours: Seuil d'obsolescence en heures (défaut: 48h)
        current_time: Horodatage de référence (défaut: maintenant UTC)

    Returns:
        Tuple[FreshnessStatus, float]: (Statut de fraîcheur, âge en heures arrondi à 1 décimale)
    """
    now = current_time or datetime.now(timezone.utc)
    
    # Assurer que les deux datetimes sont comparables en timezone
    if last_updated_at.tzinfo is None and now.tzinfo is not None:
        last_updated_at = last_updated_at.replace(tzinfo=timezone.utc)
    elif last_updated_at.tzinfo is not None and now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    delta_seconds = max(0.0, (now - last_updated_at).total_seconds())
    age_hours = round(delta_seconds / 3600.0, 1)

    status = FreshnessStatus.OUTDATED if age_hours > max_age_hours else FreshnessStatus.FRESH
    return status, age_hours


def diagnose_center(
    center: CenterStock,
    threshold_stable: float = DEFAULT_THRESHOLD_STABLE_JCM,
    threshold_risk: float = DEFAULT_THRESHOLD_RISK_JCM,
    max_data_age_hours: float = DEFAULT_MAX_DATA_AGE_HOURS,
    current_time: Optional[datetime] = None
) -> CenterDiagnosis:
    """
    Fonction centrale d'analyse d'un centre (Étape PREDICT).
    Agrège l'ensemble des règles de gestion en un diagnostic typé et vérifié.

    Args:
        center: Entité CenterStock avec les données terrain
        threshold_stable: Seuil Stable en JCM
        threshold_risk: Seuil Risque en JCM
        max_data_age_hours: Seuil d'obsolescence en heures
        current_time: Horodatage de calcul

    Returns:
        CenterDiagnosis: Objet complet contenant l'état d'alerte du centre
    """
    mobilizable = calculate_mobilizable_stock(
        physical_stock=center.physical_stock,
        reserved_stock=center.reserved_stock,
        security_stock=center.security_stock
    )

    jcm = calculate_jcm(
        mobilizable_stock=mobilizable,
        daily_consumption=center.daily_consumption
    )

    risk = classify_risk(
        jcm=jcm,
        threshold_stable=threshold_stable,
        threshold_risk=threshold_risk
    )

    freshness_status, age_hours = evaluate_data_freshness(
        last_updated_at=center.last_updated_at,
        max_age_hours=max_data_age_hours,
        current_time=current_time
    )

    return CenterDiagnosis(
        center_id=center.center_id,
        center_name=center.center_name,
        physical_stock=center.physical_stock,
        reserved_stock=center.reserved_stock,
        security_stock=center.security_stock,
        daily_consumption=center.daily_consumption,
        mobilizable_stock=mobilizable,
        jcm=jcm,
        risk_level=risk,
        freshness_status=freshness_status,
        data_age_hours=age_hours,
        evaluated_at=current_time or datetime.now(timezone.utc)
    )
