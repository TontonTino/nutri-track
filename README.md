# NUTRI-TRACK 🌾📦
**IDEAthon Digital Impact Challenge 2026**  
**Établissement :** ISGE-BF  
**Équipe :**
- KABA Amane Chadine Fanta (*Base de données + API Flask + gestion des stocks*)
- KIEMDE Banyala Latifa Alya (*Moteur de décision + NUTRI-SWITCH + logique métier*)
- KABRE Rasmata (*Dashboard MCD + visualisation des risques*)
- NITIEMA Marie Auguste Lionel (*Simulateur USSD + interfaces d'actions + historique*)

---

## 📌 Présentation de la Solution
NUTRI-TRACK est une couche décisionnelle légère pour anticiper les ruptures d'intrants nutritionnels (ATPE / RUTF) dans la prise en charge de la malnutrition aiguë chez les enfants, en facilitant un rééquilibrage pair-à-pair local supervisé par le Médecin Chef de District (MCD).

Le système fonctionne en 4 étapes clés :
1. **SEE** : Saisie terrain des stocks et distributions (via USSD).
2. **PREDICT** : Calcul du Stock Mobilisable, des Jours de Couverture Mobilisable (JCM), classification du risque et vérification de la fraîcheur des données.
3. **DECIDE (NUTRI-SWITCH)** : Recherche et simulation de transferts inter-centres garantissant la non-fragilisation du donneur.
4. **ACT** : Validation ou refus explicite par le Médecin Chef de District (MCD).

---

## 🏗️ Structure du Répertoire
```
nutri-track/
├── backend/
│   ├── core/
│   │   ├── __init__.py           # Exports officiels
│   │   ├── models.py             # Modèles de domaine typés & Enums (RiskLevel, TransferProposal...)
│   │   ├── decision_engine.py    # Moteur de décision (Stock Mobilisable, JCM, Risques, Obsolescence)
│   │   └── nutri_switch.py       # Algorithme d'optimisation NUTRI-SWITCH, simulation & arbitrage
│   └── tests/
│       ├── __init__.py
│       ├── test_decision_engine.py # Tests unitaires PREDICT & CA-BF-02
│       └── test_nutri_switch.py    # Tests unitaires DECIDE, CA-BF-03 & Scénario Kaya Nord / Sud
├── docs/
│   └── CONTRAT_INTERFACE_ALYA.md # Guide d'intégration d'Alya pour Fanta, Rasmata et Lionel
├── .gitignore
└── README.md
```

---

## 🧪 Lancement des Tests Unitaires
```bash
python -m unittest discover -s backend/tests -p "test_*.py" -v
```
Tous les critères d'acceptation du cahier des charges (CA-BF-02, CA-BF-03, Section 5 Scénario Kaya Nord 5j / Kaya Sud 19j $\to$ Transfert 72 sachets) sont couverts et validés.
