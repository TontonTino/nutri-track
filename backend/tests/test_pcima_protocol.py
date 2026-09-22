"""
Tests unitaires - Protocole Clinique PCIMA Multi-Intrants (F-75, F-100, PPN)
Fichier : backend/tests/test_pcima_protocol.py
Auteur : KIEMDE Alya

Vérifie rigoureusement l'intégration clinique du Protocole National PCIMA :
- Phase 1 (Stabilisation hospitalière) : Lait Thérapeutique F-75
- Phase de Transition : PPN (Plumpy'Nut) + F-75
- Relais d'urgence si refus / échec test d'appétit du PPN : Lait Thérapeutique F-100
- Ambulatoire CRENAS : PPN exclusif
- Compatibilité stricte des types de produits lors des transferts NUTRI-SWITCH
"""

import unittest
import sys
from pathlib import Path
from datetime import datetime, timezone

# Garantir l'importation quel que soit le répertoire courant
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from core.models import CenterStock, ProductType, FacilityType, RiskLevel
from core.decision_engine import estimate_clinical_reserved_stock, diagnose_center
from core.nutri_switch import NutriSwitchOptimizer


class TestPCIMAProtocol(unittest.TestCase):

    def setUp(self):
        self.now = datetime.now(timezone.utc)

    def test_clinical_reserved_stock_phase1_f75(self):
        """
        Phase 1 : 10 enfants sous F-75 en hospitalisation d'urgence.
        Doit calculer une réserve de boîtes de F-75 pour assurer la stabilisation.
        """
        reserved_f75 = estimate_clinical_reserved_stock(
            active_children_phase1=10,
            active_children_transition=0,
            active_children_ambulatory=0,
            product_type=ProductType.F75,
            horizon_days=14
        )
        # 10 enfants * 0.4 boîtes/j * 5 jours = 20 boîtes
        self.assertEqual(reserved_f75, 20)

    def test_clinical_reserved_stock_transition_and_f100_contingency(self):
        """
        Phase de Transition : 20 enfants.
        - La majorité (~85%) consomme le PPN.
        - Les enfants en échec/refus du test d'appétit (~15%) basculent d'urgence sur le Lait F-100.
        Le système doit anticiper la réserve de F-100 pour ces cas de refus.
        """
        # Réserve de secours en F-100 pour les 15% d'enfants refusant le PPN
        reserved_f100 = estimate_clinical_reserved_stock(
            active_children_phase1=0,
            active_children_transition=20,
            active_children_ambulatory=0,
            product_type=ProductType.F100,
            horizon_days=14,
            ppn_refusal_rate=0.15
        )
        # 20 * 0.15 = 3 enfants refusant le PPN * 0.4 boîte/j * 7 jours = 8.4 -> 8 boîtes
        self.assertEqual(reserved_f100, 8)

        # Réserve en PPN pour les enfants en transition qui acceptent le PPN
        reserved_ppn = estimate_clinical_reserved_stock(
            active_children_phase1=0,
            active_children_transition=20,
            active_children_ambulatory=0,
            product_type=ProductType.PPN,
            horizon_days=14,
            ppn_refusal_rate=0.15
        )
        # 17 enfants * 2 sachets/j * 7 jours = 238 sachets
        self.assertEqual(reserved_ppn, 238)

    def test_clinical_reserved_stock_crenas_ambulatory_ppn(self):
        """
        CRENAS ambulatoire (CSPS) : 30 enfants sous PPN (3 sachets/j pendant 14 jours).
        """
        reserved_ppn = estimate_clinical_reserved_stock(
            active_children_phase1=0,
            active_children_transition=0,
            active_children_ambulatory=30,
            product_type=ProductType.PPN,
            horizon_days=14
        )
        # 30 enfants * 3 sachets/j * 14 jours = 1260 sachets
        self.assertEqual(reserved_ppn, 1260)

    def test_nutri_switch_f75_hospital_rebalancing(self):
        """
        Scénario Hôpital CRENI :
        Le CRENI du CHUP Charles de Gaulle est en rupture de F-75 (cas graves Phase 1).
        Le CMA de Saaba (qui a aussi une unité CRENI) dispose d'un surplus de boîtes de F-75.
        NUTRI-SWITCH doit proposer un transfert de F-75 entre structures hospitalières compatibles.
        """
        # CHUP Charles de Gaulle : 15 boîtes physiques, 10 réservées, 2 sécurité, conso 2 boîtes/j
        # Mobilisable = 15 - 10 - 2 = 3 boîtes -> JCM = 3 / 2 = 1.5 jours (Risque de rupture critique)
        chup_cdg_f75 = CenterStock(
            center_id="HOSP-CHUP-CDG",
            center_name="CHUP Charles de Gaulle",
            physical_stock=15,
            reserved_stock=10,
            security_stock=2,
            daily_consumption=2.0,
            last_updated_at=self.now,
            product_type=ProductType.F75,
            facility_type=FacilityType.CRENI_HOSPITAL,
            latitude=12.3700,
            longitude=-1.5200,
        )

        # CMA Saaba CRENI : 60 boîtes physiques, 15 réservées, 5 sécurité, conso 1.5 boîtes/j
        # Mobilisable = 60 - 15 - 5 = 40 boîtes -> JCM = 40 / 1.5 = 26.6 jours (Stable)
        cma_saaba_f75 = CenterStock(
            center_id="CMA-SAABA-CRENI",
            center_name="CMA Saaba (CRENI)",
            physical_stock=60,
            reserved_stock=15,
            security_stock=5,
            daily_consumption=1.5,
            last_updated_at=self.now,
            product_type=ProductType.F75,
            facility_type=FacilityType.CRENI_HOSPITAL,
            latitude=12.3800,
            longitude=-1.4100,
        )

        # CSPS voisin qui n'a que du PPN (ne doit JAMAIS être proposé pour du F-75)
        csps_ppn_only = CenterStock(
            center_id="CSPS-LOCAL",
            center_name="CSPS Rural",
            physical_stock=500,
            reserved_stock=100,
            security_stock=50,
            daily_consumption=10.0,
            last_updated_at=self.now,
            product_type=ProductType.PPN,
            facility_type=FacilityType.CRENAS_CSPS,
        )

        optimizer = NutriSwitchOptimizer(target_recipient_jcm=14.0, donor_min_safe_jcm=10.0)
        proposals = optimizer.find_proposals_for_center(
            recipient=chup_cdg_f75,
            candidates=[cma_saaba_f75, csps_ppn_only]
        )

        # Vérification 1 : Uniquement le centre ayant du F-75 est proposé
        self.assertEqual(len(proposals), 1)
        prop = proposals[0]
        self.assertEqual(prop.donor_center_id, "CMA-SAABA-CRENI")
        self.assertEqual(prop.product_type, ProductType.F75)

        # Vérification 2 : Quantité calculée pour ramener CHUP-CDG à 14 jours de F-75
        # Besoin = (14 * 2) - 3 = 28 - 3 = 25 boîtes
        # Capacité donneur = 40 - (10 * 1.5) = 40 - 15 = 25 boîtes
        self.assertEqual(prop.quantity, 25)
        self.assertEqual(prop.recipient_impact.final_jcm, 14.0)
        self.assertEqual(prop.recipient_impact.final_risk, RiskLevel.STABLE)
        self.assertIn("F-75", prop.rationale)


if __name__ == "__main__":
    unittest.main()
