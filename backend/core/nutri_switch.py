"""
NUTRI-TRACK - Module NUTRI-SWITCH (DECIDE)
Fichier : core/nutri_switch.py
Auteur : KIEMDE Alya (Logique Métier & Moteur de Décision)

Responsabilité :
- Recherche et sélection des centres donneurs éligibles (Section 4.4 & CA-BF-03)
- Vérification absolue de non-fragilisation du donneur (JCM post-transfert >= seuil)
- Calcul de la quantité optimale transférable (Scénario de référence Section 5)
- Simulation d'impact avant / après transfert pour le demandeur et le donneur
- Classement multicritères d'aide à la décision pour le MCD (quantité, couverture, distance)
- Génération d'une proposition formelle et explicable (Section 4.4 & Section 5)

Architecture découplée : Module métier autonome, 100% testable, sans dépendance UI/BDD.
"""

from __future__ import annotations
import math
import uuid
from typing import List, Optional, Tuple, Dict, Any

from core.models import (
    CenterStock,
    CenterDiagnosis,
    SimulationImpact,
    TransferProposal,
    RiskLevel,
    ProposalStatus,
    FreshnessStatus,
)
from core.decision_engine import (
    calculate_mobilizable_stock,
    calculate_jcm,
    classify_risk,
    diagnose_center,
    DEFAULT_THRESHOLD_STABLE_JCM,
    DEFAULT_THRESHOLD_RISK_JCM,
)

# Constantes de paramétrage NUTRI-SWITCH
DEFAULT_TARGET_RECIPIENT_JCM: float = 14.0  # Cible pour sécuriser le demandeur (Stable)
DEFAULT_DONOR_MIN_SAFE_JCM: float = 10.0    # Seuil de non-fragilisation du donneur (Section 4.4)


def calculate_haversine_distance(
    lat1: float, lon1: float,
    lat2: float, lon2: float
) -> float:
    """
    Calcule la distance géodésique en kilomètres entre deux coordonnées GPS
    selon la formule de Haversine.
    """
    radius_earth_km = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(radius_earth_km * c, 1)


def simulate_center_impact(
    center: CenterStock,
    delta_stock: int
) -> SimulationImpact:
    """
    Simule l'impact d'une variation de stock sur un centre de santé.

    Args:
        center: État initial du centre
        delta_stock: Variation du stock mobilisable (+ pour demandeur, - pour donneur)

    Returns:
        SimulationImpact: Mesures avant et après l'opération simulée
    """
    initial_mob = calculate_mobilizable_stock(
        center.physical_stock, center.reserved_stock, center.security_stock
    )
    initial_jcm = calculate_jcm(initial_mob, center.daily_consumption)
    initial_risk = classify_risk(initial_jcm)

    final_mob = initial_mob + delta_stock
    final_jcm = calculate_jcm(final_mob, center.daily_consumption)
    final_risk = classify_risk(final_jcm)

    return SimulationImpact(
        center_id=center.center_id,
        center_name=center.center_name,
        initial_mobilizable=initial_mob,
        initial_jcm=initial_jcm,
        initial_risk=initial_risk,
        delta_stock=delta_stock,
        final_mobilizable=final_mob,
        final_jcm=final_jcm,
        final_risk=final_risk,
    )


def compute_transfer_quantities(
    recipient: CenterStock,
    donor: CenterStock,
    target_recipient_jcm: float = DEFAULT_TARGET_RECIPIENT_JCM,
    donor_min_safe_jcm: float = DEFAULT_DONOR_MIN_SAFE_JCM
) -> Tuple[int, int, int]:
    """
    Calcule les besoins du demandeur, la capacité sécurisée du donneur
    et la quantité recommandée à transférer.

    Formule Section 5 du CDC :
    - Besoin demandeur = (Cible_JCM * Conso) - Stock_Mobilisable_Actuel
    - Capacité donneur = Stock_Mobilisable_Donneur - (Seuil_Sécurité_Donneur * Conso_Donneur)
    - Quantité transférée = min(Besoin, Capacité)

    Returns:
        Tuple[int, int, int]: (quantité_recommandée, besoin_demandeur, capacité_donneur)
    """
    recip_mob = calculate_mobilizable_stock(
        recipient.physical_stock, recipient.reserved_stock, recipient.security_stock
    )
    donor_mob = calculate_mobilizable_stock(
        donor.physical_stock, donor.reserved_stock, donor.security_stock
    )

    # 1. Quantité requise par le demandeur pour atteindre le niveau cible (ex: 14 jours)
    target_mob_recip = target_recipient_jcm * recipient.daily_consumption
    needed_qty = max(0, int(math.ceil(target_mob_recip - recip_mob)))

    # 2. Quantité maximale que le donneur peut céder sans franchir son seuil de sécurité
    donor_min_reserve = donor_min_safe_jcm * donor.daily_consumption
    max_donor_capacity = max(0, int(math.floor(donor_mob - donor_min_reserve)))

    # 3. Quantité recommandée arbitrée
    recommended_qty = min(needed_qty, max_donor_capacity)

    return recommended_qty, needed_qty, max_donor_capacity


def is_donor_eligible(
    donor: CenterStock,
    transfer_qty: int,
    donor_min_safe_jcm: float = DEFAULT_DONOR_MIN_SAFE_JCM
) -> bool:
    """
    Règle CA-BF-03 :
    Un centre donneur n'est éligible que si, après le transfert simulé,
    son JCM reste >= au seuil de sécurité configuré.

    Args:
        donor: Centre candidat au don
        transfer_qty: Quantité soustraite
        donor_min_safe_jcm: Seuil minimal de couverture en jours (ex: 10.0 ou 7.0)

    Returns:
        bool: True si le donneur reste protégé et ne se fragilise pas
    """
    if transfer_qty <= 0:
        return False

    impact = simulate_center_impact(donor, -transfer_qty)
    return impact.final_jcm >= donor_min_safe_jcm


def compute_proposal_score(
    needed_qty: int,
    transfer_qty: int,
    donor_final_jcm: float,
    distance_km: Optional[float],
    is_fresh_data: bool
) -> float:
    """
    Algorithme de comparaison et de scoring multicritère (Section 4.4).
    Pondérations :
    - Taux de couverture du besoin (40%)
    - Sérénité résiduelle du donneur (30%)
    - Proximité kilométrique (20%)
    - Fraîcheur des données terrain (10%)

    Returns:
        float: Score sur 100 points
    """
    # 1. Satisfaction du besoin (max 40 pts)
    fulfillment_ratio = (transfer_qty / needed_qty) if needed_qty > 0 else 1.0
    score_fulfillment = min(1.0, fulfillment_ratio) * 40.0

    # 2. Sérénité du donneur (au-dessus de 14j = max pts, max 30 pts)
    donor_safety_ratio = min(1.0, max(0.0, donor_final_jcm / 20.0))
    score_safety = donor_safety_ratio * 30.0

    # 3. Proximité géographique (décroissance avec la distance, max 20 pts)
    if distance_km is not None and distance_km >= 0:
        score_proximity = (1.0 / (1.0 + (distance_km / 25.0))) * 20.0
    else:
        # Distance non renseignée -> score médian par défaut
        score_proximity = 12.0

    # 4. Fraîcheur de la donnée (max 10 pts)
    score_freshness = 10.0 if is_fresh_data else 3.0

    return round(score_fulfillment + score_safety + score_proximity + score_freshness, 1)


class NutriSwitchOptimizer:
    """
    Moteur d'optimisation et d'appariement NUTRI-SWITCH.
    Assure l'étape DECIDE du cahier des charges.
    """

    def __init__(
        self,
        target_recipient_jcm: float = DEFAULT_TARGET_RECIPIENT_JCM,
        donor_min_safe_jcm: float = DEFAULT_DONOR_MIN_SAFE_JCM,
        threshold_risk_jcm: float = DEFAULT_THRESHOLD_RISK_JCM
    ):
        self.target_recipient_jcm = target_recipient_jcm
        self.donor_min_safe_jcm = donor_min_safe_jcm
        self.threshold_risk_jcm = threshold_risk_jcm

    def find_proposals_for_center(
        self,
        recipient: CenterStock,
        candidates: List[CenterStock],
        distances_km_map: Optional[Dict[str, float]] = None
    ) -> List[TransferProposal]:
        """
        Recherche et classe toutes les propositions d'aide possibles pour un centre demandeur.

        Args:
            recipient: Centre en situation de risque (ex: Kaya Nord)
            candidates: Liste de tous les centres potentiels du district (ex: Kaya Sud, etc.)
            distances_km_map: Dictionnaire optionnel center_id -> distance en km

        Returns:
            List[TransferProposal]: Propositions ordonnées par score décroissant (meilleure option en tête)
        """
        proposals: List[TransferProposal] = []

        # Diagnostic initial du demandeur
        recip_diag = diagnose_center(recipient)
        
        # Si le centre n'est pas en risque ou tension, aucun besoin de transfert d'urgence
        if recip_diag.risk_level == RiskLevel.STABLE:
            return []

        for candidate in candidates:
            # Règle d'exclusion : on ne transfère pas d'un centre vers lui-même
            if candidate.center_id == recipient.center_id:
                continue

            # Règle d'exclusion : un centre en risque de rupture ne peut pas être donneur
            cand_diag = diagnose_center(candidate)
            if cand_diag.risk_level == RiskLevel.RISK_OF_STOCKOUT:
                continue

            # Calcul des quantités selon les formules officielles (Section 5)
            transfer_qty, needed_qty, max_capacity = compute_transfer_quantities(
                recipient=recipient,
                donor=candidate,
                target_recipient_jcm=self.target_recipient_jcm,
                donor_min_safe_jcm=self.donor_min_safe_jcm
            )

            # Si aucune quantité n'est mobilisable sans fragiliser le donneur
            if transfer_qty <= 0:
                continue

            # Règle CA-BF-03 : Vérification formelle d'éligibilité du donneur
            if not is_donor_eligible(candidate, transfer_qty, self.donor_min_safe_jcm):
                continue

            # Simulation des impacts avant/après
            recip_impact = simulate_center_impact(recipient, +transfer_qty)
            donor_impact = simulate_center_impact(candidate, -transfer_qty)

            # Calcul de distance
            dist_km = None
            if distances_km_map and candidate.center_id in distances_km_map:
                dist_km = distances_km_map[candidate.center_id]
            elif (recipient.latitude is not None and recipient.longitude is not None and
                  candidate.latitude is not None and candidate.longitude is not None):
                dist_km = calculate_haversine_distance(
                    recipient.latitude, recipient.longitude,
                    candidate.latitude, candidate.longitude
                )

            # Scoring multicritère pour arbitrage
            is_fresh = (cand_diag.freshness_status == FreshnessStatus.FRESH)
            score = compute_proposal_score(
                needed_qty=needed_qty,
                transfer_qty=transfer_qty,
                donor_final_jcm=donor_impact.final_jcm,
                distance_km=dist_km,
                is_fresh_data=is_fresh
            )

            # Rationale explicable pour le Médecin Chef de District (MCD)
            rationale = (
                f"Transfert recommandé de {transfer_qty} sachets depuis {candidate.center_name} "
                f"vers {recipient.center_name}. "
                f"Permet à {recipient.center_name} de passer de {recip_impact.initial_jcm}j à {recip_impact.final_jcm}j "
                f"({recip_impact.final_risk.value}), tout en maintenant {candidate.center_name} à {donor_impact.final_jcm}j "
                f"(seuil de sécurité préservé >= {self.donor_min_safe_jcm}j)."
            )

            proposal = TransferProposal(
                proposal_id=f"PROP-{uuid.uuid4().hex[:8].upper()}",
                recipient_center_id=recipient.center_id,
                recipient_center_name=recipient.center_name,
                donor_center_id=candidate.center_id,
                donor_center_name=candidate.center_name,
                quantity=transfer_qty,
                distance_km=dist_km,
                recipient_impact=recip_impact,
                donor_impact=donor_impact,
                score=score,
                rationale=rationale,
                status=ProposalStatus.PENDING
            )
            proposals.append(proposal)

        # Tri par score décroissant (meilleure recommandation en premier)
        proposals.sort(key=lambda p: p.score, reverse=True)
        return proposals
