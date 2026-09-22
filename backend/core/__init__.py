"""
Package core de NUTRI-TRACK.
Responsable : KIEMDE Alya
Moteur de décision + NUTRI-SWITCH + Logique Métier.
Supporte le protocole PCIMA Multi-Intrants (F-75, F-100, PPN).
"""

from core.models import (
    RiskLevel,
    FreshnessStatus,
    ProposalStatus,
    ProductType,
    FacilityType,
    CenterStock,
    CenterDiagnosis,
    SimulationImpact,
    TransferProposal,
)
from core.decision_engine import (
    calculate_mobilizable_stock,
    calculate_jcm,
    classify_risk,
    evaluate_data_freshness,
    diagnose_center,
    estimate_clinical_reserved_stock,
    DEFAULT_THRESHOLD_STABLE_JCM,
    DEFAULT_THRESHOLD_RISK_JCM,
    DEFAULT_MAX_DATA_AGE_HOURS,
)
from core.nutri_switch import (
    NutriSwitchOptimizer,
    simulate_center_impact,
    is_donor_eligible,
    compute_transfer_quantities,
    compute_proposal_score,
    calculate_haversine_distance,
    DEFAULT_TARGET_RECIPIENT_JCM,
    DEFAULT_DONOR_MIN_SAFE_JCM,
)

__all__ = [
    # Models & Enums
    "RiskLevel",
    "FreshnessStatus",
    "ProposalStatus",
    "ProductType",
    "FacilityType",
    "CenterStock",
    "CenterDiagnosis",
    "SimulationImpact",
    "TransferProposal",
    # Decision Engine
    "calculate_mobilizable_stock",
    "calculate_jcm",
    "classify_risk",
    "evaluate_data_freshness",
    "diagnose_center",
    "estimate_clinical_reserved_stock",
    "DEFAULT_THRESHOLD_STABLE_JCM",
    "DEFAULT_THRESHOLD_RISK_JCM",
    "DEFAULT_MAX_DATA_AGE_HOURS",
    # NUTRI-SWITCH
    "NutriSwitchOptimizer",
    "simulate_center_impact",
    "is_donor_eligible",
    "compute_transfer_quantities",
    "compute_proposal_score",
    "calculate_haversine_distance",
    "DEFAULT_TARGET_RECIPIENT_JCM",
    "DEFAULT_DONOR_MIN_SAFE_JCM",
]
