# Contrat d'Interface & Intégration - Module KIEMDE Alya
**Projet :** NUTRI-TRACK - IDEAthon Digital Impact Challenge 2026  
**Responsable du module :** KIEMDE Banyala Latifa Alya  
**Composants livrés :** Moteur de décision (`backend/core/decision_engine.py`) + Algorithme de rééquilibrage (`backend/core/nutri_switch.py`) + Modèles de données (`backend/core/models.py`)

---

## 1. Principes d'Architecture (Clean Architecture)
Le module d'Alya est **100% découplé** de toute dépendance externe (Flask, SQLite, HTML/JS) :
- Fonctions pures, déterministes et sans effets de bord.
- Validation des critères d'acceptation par tests unitaires automatisés (`tests/`).
- Méthode `.to_dict()` intégrée sur chaque modèle pour une sérialisation JSON directe.

---

## 2. Guide d'Intégration pour l'Équipe

### 2.1 Pour KABA Fanta (Base de Données + API Flask)
Fanta peut importer directement les fonctions et classes dans ses contrôleurs Flask sans réécrire la logique :

```python
from datetime import datetime, timezone
from backend.core.models import CenterStock
from backend.core.decision_engine import diagnose_center
from backend.core.nutri_switch import NutriSwitchOptimizer

# 1. Dans la route GET /api/centers/<id>/diagnosis
@app.route('/api/centers/<center_id>/diagnosis', methods=['GET'])
def get_center_diagnosis(center_id):
    # Récupération en BDD SQLite des données du centre
    row = db.get_center(center_id)
    
    # Instanciation de l'entité métier
    center = CenterStock(
        center_id=row['id'],
        center_name=row['name'],
        physical_stock=row['physical_stock'],
        reserved_stock=row['reserved_stock'],
        security_stock=row['security_stock'],
        daily_consumption=row['daily_consumption'],
        last_updated_at=datetime.fromisoformat(row['last_updated_at']),
        latitude=row.get('latitude'),
        longitude=row.get('longitude')
    )
    
    # Calcul automatique PREDICT
    diagnosis = diagnose_center(center)
    return jsonify(diagnosis.to_dict()), 200


# 2. Dans la route GET /api/recommendations/<recipient_id>
@app.route('/api/recommendations/<recipient_id>', methods=['GET'])
def get_recommendations(recipient_id):
    recipient = db.get_center_as_model(recipient_id)
    all_candidates = db.get_all_other_centers_as_models(exclude_id=recipient_id)
    
    # Étape DECIDE (NUTRI-SWITCH)
    optimizer = NutriSwitchOptimizer(target_recipient_jcm=14.0, donor_min_safe_jcm=10.0)
    proposals = optimizer.find_proposals_for_center(
        recipient=recipient,
        candidates=all_candidates
    )
    
    return jsonify([p.to_dict() for p in proposals]), 200
```

---

### 2.2 Pour KABRE Rasmata (Dashboard MCD + Visualisation)
Chaque objet sérialisé via `.to_dict()` fournit à Rasmata exactement les champs nécessaires pour l'affichage UI :

| Clé JSON | Type | Usage dans le Dashboard MCD |
| :--- | :--- | :--- |
| `mobilizable_stock` | `int` | Jauge de stock mobilisable disponible |
| `jcm` | `float` | Nombre de jours affiché en grand (ex: `5.0 j` ou `11.8 j`) |
| `risk_level` | `string` | Badge couleur : `"Stable"` (Vert), `"Tension"` (Orange), `"Risque de rupture"` (Rouge) |
| `freshness_status` | `string` | Indicateur : `"A jour"` ou `"Obsolète"` (si $> 48\text{h}$) |
| `data_age_hours` | `float` | Horodatage textuel : ex. `"Mis à jour il y a 3.5h"` |
| `recipient_impact` | `object` | Vue avant/après pour le centre demandeur |
| `donor_impact` | `object` | Vue avant/après pour rassurer le MCD que le donneur reste protégé |
| `rationale` | `string` | Explication claire générée pour justifier la proposition |
| `score` | `float` | Barre de pertinence/confiance de la recommandation |

---

### 2.3 Pour NITIEMA Lionel (Simulateur USSD & Historique)
- Dès qu'un Agent de Santé Communautaire (ASC) valide une déclaration de stock ou une distribution via l'USSD :
  1. Fanta met à jour la ligne en BDD.
  2. Lionel / Fanta appellent `diagnose_center(center)`.
  3. Si `risk_level == "Risque de rupture"`, NUTRI-SWITCH est immédiatement déclenché pour préparer la proposition destinée au MCD.
  4. L'historique enregistre l'impact calculé par `simulate_center_impact()`.

---

## 3. Conformité aux Critères du Cahier des Charges

| Critère | Description | Statut des Tests |
| :--- | :--- | :---: |
| **CA-BF-02** | Stock mobilisable = 40, conso = 8/j $\implies$ JCM = 5 jours | **100% Validé** |
| **CA-BF-03** | Donneur éligible SSI JCM simulé après don $\ge$ seuil minimal de sécurité | **100% Validé** |
| **Section 5** | Scénario Kaya Nord (40 sachets, 5j) + Kaya Sud (190 sachets, 19j) $\implies$ Transfert de 72 sachets | **100% Validé** |
| **BF-05** | Alerte si dernière remontée de stock $> 48\text{h}$ | **100% Validé** |

---

## 4. Comment Lancer les Tests Unitaires
Depuis la racine du projet :
```bash
python -m unittest discover -s tests -p "test_*.py" -v
```
Tous les 13 tests s'exécutent en moins de 10 millisecondes et confirment l'intégrité de la logique métier.
