"""
NUTRI-TRACK - Module Domaine Métier
Fichier : core/models.py
Auteur : KIEMDE Alya (Logique Métier & Moteur de Décision)

Modèles de données du domaine métier (Entities, Value Objects, Enums).
Conforme au Cahier des Charges - IDEAthon Digital Impact Challenge 2026.
Architecture découplée : Aucune dépendance de présentation, de framework web ou de base de données.
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Dict, Any, Tuple


class RiskLevel(str, Enum):
    """
    Classification du risque selon les Jours de Couverture Mobilisable (JCM).
    Section 4.3 du Cahier des Charges.
    """
    STABLE = "Stable"                    # JCM >= 14 jours
    TENSION = "Tension"                  # 7 jours < JCM < 14 jours
    RISK_OF_STOCKOUT = "Risque de rupture" # JCM <= 7 jours


class FreshnessStatus(str, Enum):
    """
    Statut de fraîcheur de la donnée (Section 4, BF-05).
    """
    FRESH = "A jour"
    OUTDATED = "Obsolète"


class ProposalStatus(str, Enum):
    """
    Statut de la proposition de transfert dans le workflow DECIDE -> ACT.
    """
    PENDING = "En attente"
    VALIDATED = "Validé"
    REJECTED = "Refusé"


@dataclass(frozen=True)
class CenterStock:
    """
    Représente l'état instantané des stocks et de la consommation d'un centre de santé.
    Section 4.1 & 4.2 du Cahier des Charges.
    """
    center_id: str
    center_name: str
    physical_stock: int         # Stock physique (sachets ATPE/RUTF)
    reserved_stock: int         # Stock réservé estimé (enfants déjà sous traitement)
    security_stock: int         # Stock de sécurité
    daily_consumption: float    # Consommation quotidienne observée (sachets/jour)
    last_updated_at: datetime   # Date/heure du dernier relevé (SEE)
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    def __post_init__(self):
        if self.physical_stock < 0:
            raise ValueError(f"Le stock physique ne peut pas être négatif ({self.physical_stock})")
        if self.reserved_stock < 0:
            raise ValueError(f"Le stock réservé ne peut pas être négatif ({self.reserved_stock})")
        if self.security_stock < 0:
            raise ValueError(f"Le stock de sécurité ne peut pas être négatif ({self.security_stock})")
        if self.daily_consumption < 0:
            raise ValueError(f"La consommation quotidienne ne peut pas être négative ({self.daily_consumption})")


@dataclass(frozen=True)
class CenterDiagnosis:
    """
    Résultat de l'analyse décisionnelle pour un centre de santé (Étape PREDICT).
    """
    center_id: str
    center_name: str
    physical_stock: int
    reserved_stock: int
    security_stock: int
    daily_consumption: float
    mobilizable_stock: int
    jcm: float
    risk_level: RiskLevel
    freshness_status: FreshnessStatus
    data_age_hours: float
    evaluated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        """Sérialisation propre prête pour Fanta (API) et Rasmata (Dashboard)."""
        data = asdict(self)
        data["risk_level"] = self.risk_level.value
        data["freshness_status"] = self.freshness_status.value
        data["evaluated_at"] = self.evaluated_at.isoformat()
        return data


@dataclass(frozen=True)
class SimulationImpact:
    """
    Impact simulé sur un centre avant et après une opération de rééquilibrage.
    """
    center_id: str
    center_name: str
    initial_mobilizable: int
    initial_jcm: float
    initial_risk: RiskLevel
    delta_stock: int            # Positif pour le demandeur, négatif pour le donneur
    final_mobilizable: int
    final_jcm: float
    final_risk: RiskLevel

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["initial_risk"] = self.initial_risk.value
        data["final_risk"] = self.final_risk.value
        return data


@dataclass
class TransferProposal:
    """
    Proposition de transfert générée par NUTRI-SWITCH (Étape DECIDE).
    Soumise à l'arbitrage humain du MCD (Étape ACT).
    Section 4.4 et Section 5 du Cahier des Charges.
    """
    proposal_id: str
    recipient_center_id: str
    recipient_center_name: str
    donor_center_id: str
    donor_center_name: str
    quantity: int                       # Nombre de sachets proposés
    distance_km: Optional[float]        # Distance estimée entre les deux centres
    recipient_impact: SimulationImpact  # Avant/après pour le demandeur
    donor_impact: SimulationImpact      # Avant/après pour le donneur (vérification non-fragilisation)
    score: float                        # Score multicritère d'aide à la décision
    rationale: str                      # Justification claire et explicable pour le MCD
    status: ProposalStatus = ProposalStatus.PENDING
    decision_reason: Optional[str] = None
    decided_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        """Sérialisation complète pour les besoins de l'API et de la visualisation."""
        return {
            "proposal_id": self.proposal_id,
            "recipient_center_id": self.recipient_center_id,
            "recipient_center_name": self.recipient_center_name,
            "donor_center_id": self.donor_center_id,
            "donor_center_name": self.donor_center_name,
            "quantity": self.quantity,
            "distance_km": self.distance_km,
            "recipient_impact": self.recipient_impact.to_dict(),
            "donor_impact": self.donor_impact.to_dict(),
            "score": round(self.score, 2),
            "rationale": self.rationale,
            "status": self.status.value,
            "decision_reason": self.decision_reason,
            "decided_at": self.decided_at.isoformat() if self.decided_at else None,
            "created_at": self.created_at.isoformat(),
        }
