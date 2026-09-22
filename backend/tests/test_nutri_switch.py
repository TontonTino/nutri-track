"""
Tests unitaires - Module NUTRI-SWITCH (DECIDE)
Fichier : tests/test_nutri_switch.py
Auteur : KIEMDE Alya

Vérifie rigoureusement :
- Le scénario de référence complet Kaya Nord / Kaya Sud (Section 5)
- Le critère d'acceptation CA-BF-03 (non-fragilisation absolue du donneur)
- Le calcul de la quantité optimale (72 sachets)
- La simulation des impacts avant/après (Kaya Nord -> 14j, Kaya Sud -> 11.8j)
- L'arbitrage et le classement multicritères en présence de plusieurs centres
"""

import unittest
import sys
from pathlib import Path
from datetime import datetime, timezone

# Garantir l'importation quel que soit le répertoire courant
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from core.models import CenterStock, RiskLevel, ProposalStatus
from core.nutri_switch import (
    NutriSwitchOptimizer,
    compute_transfer_quantities,
    simulate_center_impact,
    is_donor_eligible,
    calculate_haversine_distance,
)


class TestNutriSwitch(unittest.TestCase):

    def setUp(self):
        self.now = datetime.now(timezone.utc)
        # 1. Kaya Nord (Demandeur en risque de rupture)
        self.kaya_nord = CenterStock(
            center_id="CS-KAYA-NORD",
            center_name="Kaya Nord",
            physical_stock=100,
            reserved_stock=40,
            security_stock=20,
            daily_consumption=8.0,
            last_updated_at=self.now,
            latitude=13.0900,
            longitude=-1.0800,
        )

        # 2. Kaya Sud (Donneur potentiel stable)
        self.kaya_sud = CenterStock(
            center_id="CS-KAYA-SUD",
            center_name="Kaya Sud",
            physical_stock=350,
            reserved_stock=100,
            security_stock=60,
            daily_consumption=10.0,
            last_updated_at=self.now,
            latitude=13.0600,
            longitude=-1.0900,
        )

    def test_section_5_reference_scenario_exact_quantities(self):
        """
        Vérifie au centième près les chiffres du Cas d'Usage de Référence (Section 5 du CDC) :
        - Kaya Nord initial : 40 mobilisables, conso 8/j -> 5 jours (Risque)
        - Kaya Sud initial : 190 mobilisables, conso 10/j -> 19 jours (Stable)
        - Quantité de transfert calculée : 72 sachets
        - Après transfert :
            * Kaya Sud : 190 - 72 = 118 sachets mobilisables -> 118 / 10 = 11.8 jours
            * Kaya Nord : 40 + 72 = 112 sachets mobilisables -> 112 / 8 = 14.0 jours
        """
        recommended_qty, needed_qty, max_capacity = compute_transfer_quantities(
            recipient=self.kaya_nord,
            donor=self.kaya_sud,
            target_recipient_jcm=14.0,
            donor_min_safe_jcm=10.0
        )

        # Vérification du besoin du demandeur pour atteindre 14j : (14 * 8) - 40 = 112 - 40 = 72
        self.assertEqual(needed_qty, 72)
        # Capacité max du donneur sans passer sous 10j : 190 - (10 * 10) = 90
        self.assertEqual(max_capacity, 90)
        # Quantité retenue
        self.assertEqual(recommended_qty, 72)

        # Simulation d'impact
        impact_recip = simulate_center_impact(self.kaya_nord, +72)
        impact_donor = simulate_center_impact(self.kaya_sud, -72)

        # Vérifications demandeur (Kaya Nord)
        self.assertEqual(impact_recip.initial_mobilizable, 40)
        self.assertEqual(impact_recip.initial_jcm, 5.0)
        self.assertEqual(impact_recip.initial_risk, RiskLevel.RISK_OF_STOCKOUT)
        self.assertEqual(impact_recip.final_mobilizable, 112)
        self.assertEqual(impact_recip.final_jcm, 14.0)
        self.assertEqual(impact_recip.final_risk, RiskLevel.STABLE)

        # Vérifications donneur (Kaya Sud)
        self.assertEqual(impact_donor.initial_mobilizable, 190)
        self.assertEqual(impact_donor.initial_jcm, 19.0)
        self.assertEqual(impact_donor.initial_risk, RiskLevel.STABLE)
        self.assertEqual(impact_donor.final_mobilizable, 118)
        self.assertEqual(impact_donor.final_jcm, 11.8)
        # 11.8j se situe entre 7j et 14j -> Tension acceptable sans danger
        self.assertEqual(impact_donor.final_risk, RiskLevel.TENSION)

    def test_ca_bf_03_acceptance_criterion_donor_protection(self):
        """
        Critère d'acceptation officiel CA-BF-03 :
        Un centre donneur n'est proposé QUE SI son JCM simulé après transfert
        reste >= au seuil minimal de sécurité configuré.
        """
        # Avec seuil de sécurité à 10.0 jours :
        # Transférer 72 sachets laisse Kaya Sud à 11.8 jours (11.8 >= 10.0 -> Éligible)
        self.assertTrue(is_donor_eligible(self.kaya_sud, transfer_qty=72, donor_min_safe_jcm=10.0))

        # Si on tentait un transfert excessif de 110 sachets :
        # Reste = 190 - 110 = 80 sachets -> JCM = 80 / 10 = 8.0 jours (< 10.0 -> Inéligible)
        self.assertFalse(is_donor_eligible(self.kaya_sud, transfer_qty=110, donor_min_safe_jcm=10.0))

    def test_optimizer_end_to_end_proposal_generation(self):
        """
        Test du workflow complet de NutriSwitchOptimizer :
        Génération d'une proposition avec structure conforme prête pour le MCD.
        """
        optimizer = NutriSwitchOptimizer(target_recipient_jcm=14.0, donor_min_safe_jcm=10.0)
        proposals = optimizer.find_proposals_for_center(
            recipient=self.kaya_nord,
            candidates=[self.kaya_nord, self.kaya_sud]  # Inclut le demandeur pour tester l'auto-exclusion
        )

        self.assertEqual(len(proposals), 1)
        prop = proposals[0]

        self.assertEqual(prop.recipient_center_id, "CS-KAYA-NORD")
        self.assertEqual(prop.donor_center_id, "CS-KAYA-SUD")
        self.assertEqual(prop.quantity, 72)
        self.assertEqual(prop.status, ProposalStatus.PENDING)
        self.assertGreater(prop.score, 0.0)
        self.assertIn("Transfert recommandé de 72 sachets", prop.rationale)

    def test_multi_donor_ranking_by_score(self):
        """
        Vérifie l'arbitrage multicritère (Section 4.4) :
        Lorsque plusieurs centres sont disponibles, le système priorise
        le centre le plus adapté (proximité, stock disponible, robustesse).
        """
        # Centre 3 fictif : Kaya Est, plus éloigné et avec un stock moindre
        kaya_est = CenterStock(
            center_id="CS-KAYA-EST",
            center_name="Kaya Est",
            physical_stock=200,
            reserved_stock=60,
            security_stock=40,
            daily_consumption=8.0,
            last_updated_at=self.now,
            latitude=13.2500,  # Plus loin
            longitude=-0.8000,
        )

        optimizer = NutriSwitchOptimizer(target_recipient_jcm=14.0, donor_min_safe_jcm=10.0)
        proposals = optimizer.find_proposals_for_center(
            recipient=self.kaya_nord,
            candidates=[self.kaya_sud, kaya_est]
        )

        self.assertEqual(len(proposals), 2)
        # Kaya Sud doit être classé premier (meilleure couverture + plus proche)
        self.assertEqual(proposals[0].donor_center_id, "CS-KAYA-SUD")
        self.assertGreaterEqual(proposals[0].score, proposals[1].score)

    def test_candidate_in_stockout_risk_cannot_be_donor(self):
        """
        Un centre lui-même en risque ou en détresse ne peut JAMAIS être proposé comme donneur.
        """
        fragile_center = CenterStock(
            center_id="CS-FRAGILE",
            center_name="Centre Fragile",
            physical_stock=80,
            reserved_stock=40,
            security_stock=20,
            daily_consumption=8.0,
            last_updated_at=self.now,  # Mobilisable = 20, Conso = 8 -> JCM = 2.5j (Risque)
        )

        optimizer = NutriSwitchOptimizer()
        proposals = optimizer.find_proposals_for_center(
            recipient=self.kaya_nord,
            candidates=[fragile_center]
        )

        # Aucune proposition autorisée
        self.assertEqual(len(proposals), 0)

    def test_haversine_distance_calculation(self):
        """
        Vérification du calcul de distance GPS.
        """
        # Coordonnées Kaya Nord et Kaya Sud (environ 3 à 4 km)
        dist = calculate_haversine_distance(13.0900, -1.0800, 13.0600, -1.0900)
        self.assertGreater(dist, 2.0)
        self.assertLess(dist, 6.0)


if __name__ == "__main__":
    unittest.main()
