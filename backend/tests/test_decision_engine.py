"""
Tests unitaires - Moteur de Décision (PREDICT)
Fichier : tests/test_decision_engine.py
Auteur : KIEMDE Alya

Vérifie rigoureusement la conformité avec le Cahier des Charges :
- Formule du Stock Mobilisable (Section 4.1)
- Formule des JCM (Section 4.2 & CA-BF-02)
- Seuils de classification du risque (Section 4.3)
- Détection des données obsolètes (BF-05)
- Cas d'usage de référence Kaya Nord et Kaya Sud (Section 5)
"""

import unittest
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Garantir l'importation quel que soit le répertoire courant
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from core.models import CenterStock, RiskLevel, FreshnessStatus
from core.decision_engine import (
    calculate_mobilizable_stock,
    calculate_jcm,
    classify_risk,
    evaluate_data_freshness,
    diagnose_center,
)


class TestDecisionEngine(unittest.TestCase):

    def test_ca_bf_02_acceptance_criterion(self):
        """
        Critère d'acceptation officiel CA-BF-02 :
        Pour un stock mobilisable de 40 sachets et une conso de 8/jour,
        le JCM calculé doit être exactement de 5 jours.
        """
        mobilizable = 40
        consumption = 8.0
        jcm = calculate_jcm(mobilizable, consumption)
        self.assertEqual(jcm, 5.0)

    def test_reference_scenario_kaya_nord_initial_state(self):
        """
        Cas d'usage Section 5 : Kaya Nord
        - Stock physique : 100 sachets
        - Stock réservé : 40 sachets
        - Stock de sécurité : 20 sachets
        - Consommation : 8 sachets/jour
        -> Stock Mobilisable = 100 - 40 - 20 = 40 sachets
        -> JCM = 40 / 8 = 5 jours
        -> Statut = Risque de rupture
        """
        now = datetime.now(timezone.utc)
        kaya_nord = CenterStock(
            center_id="CS-KAYA-NORD",
            center_name="Kaya Nord",
            physical_stock=100,
            reserved_stock=40,
            security_stock=20,
            daily_consumption=8.0,
            last_updated_at=now,
        )

        diag = diagnose_center(kaya_nord, current_time=now)

        self.assertEqual(diag.mobilizable_stock, 40)
        self.assertEqual(diag.jcm, 5.0)
        self.assertEqual(diag.risk_level, RiskLevel.RISK_OF_STOCKOUT)
        self.assertEqual(diag.freshness_status, FreshnessStatus.FRESH)

    def test_reference_scenario_kaya_sud_initial_state(self):
        """
        Cas d'usage Section 5 : Kaya Sud
        - Stock physique : 350 sachets
        - Stock réservé : 100 sachets
        - Stock de sécurité : 60 sachets
        - Consommation : 10 sachets/jour
        -> Stock Mobilisable = 350 - 100 - 60 = 190 sachets
        -> JCM = 190 / 10 = 19 jours
        -> Statut = Stable
        """
        now = datetime.now(timezone.utc)
        kaya_sud = CenterStock(
            center_id="CS-KAYA-SUD",
            center_name="Kaya Sud",
            physical_stock=350,
            reserved_stock=100,
            security_stock=60,
            daily_consumption=10.0,
            last_updated_at=now,
        )

        diag = diagnose_center(kaya_sud, current_time=now)

        self.assertEqual(diag.mobilizable_stock, 190)
        self.assertEqual(diag.jcm, 19.0)
        self.assertEqual(diag.risk_level, RiskLevel.STABLE)

    def test_risk_classification_boundary_values(self):
        """
        Validation stricte des frontières de seuils (Section 4.3) :
        - Stable : JCM >= 14 jours
        - Tension : 7 jours < JCM < 14 jours
        - Risque de rupture : JCM <= 7 jours
        """
        self.assertEqual(classify_risk(14.0), RiskLevel.STABLE)
        self.assertEqual(classify_risk(14.1), RiskLevel.STABLE)
        self.assertEqual(classify_risk(13.9), RiskLevel.TENSION)
        self.assertEqual(classify_risk(10.0), RiskLevel.TENSION)
        self.assertEqual(classify_risk(7.1), RiskLevel.TENSION)
        self.assertEqual(classify_risk(7.0), RiskLevel.RISK_OF_STOCKOUT)
        self.assertEqual(classify_risk(5.0), RiskLevel.RISK_OF_STOCKOUT)
        self.assertEqual(classify_risk(0.0), RiskLevel.RISK_OF_STOCKOUT)

    def test_mobilizable_stock_edge_cases(self):
        """
        Vérifie le comportement si le stock physique est inférieur
        au cumul stock réservé + sécurité.
        """
        # Déficit net
        mob_negatif = calculate_mobilizable_stock(
            physical_stock=50,
            reserved_stock=40,
            security_stock=30  # 50 - 40 - 30 = -20
        )
        self.assertEqual(mob_negatif, -20)
        # Le JCM en cas de stock mobilisable négatif doit être protégé à 0.0
        jcm = calculate_jcm(mob_negatif, 5.0)
        self.assertEqual(jcm, 0.0)

    def test_zero_consumption_safety(self):
        """
        Sécurité anti-crash division par zéro si aucune consommation n'est observée.
        """
        self.assertEqual(calculate_jcm(100, 0.0), 999.0)
        self.assertEqual(calculate_jcm(0, 0.0), 0.0)

    def test_data_freshness_evaluation_bf_05(self):
        """
        Exigence BF-05 : Identification des données obsolètes (> 48h par défaut).
        """
        ref_time = datetime(2026, 9, 22, 12, 0, 0, tzinfo=timezone.utc)

        # Donnée récente (12h d'âge)
        recent_date = ref_time - timedelta(hours=12)
        status_rec, age_rec = evaluate_data_freshness(recent_date, max_age_hours=48.0, current_time=ref_time)
        self.assertEqual(status_rec, FreshnessStatus.FRESH)
        self.assertEqual(age_rec, 12.0)

        # Donnée obsolète (52h d'âge)
        old_date = ref_time - timedelta(hours=52)
        status_old, age_old = evaluate_data_freshness(old_date, max_age_hours=48.0, current_time=ref_time)
        self.assertEqual(status_old, FreshnessStatus.OUTDATED)
        self.assertEqual(age_old, 52.0)


if __name__ == "__main__":
    unittest.main()
