# NUTRI-DÉPIST Backend & Moteur de Classification

Cerveau du système de dépistage nutritionnel communautaire pour la prise en charge rapide des enfants (6-59 mois), femmes enceintes et personnes âgées.

## 🌿 Branche Git
`alya/engine-api`

## 🚀 Démarrage Rapide

```bash
# Installation des dépendances
pip install -r requirements.txt

# Lancement des tests unitaires et d'intégration
pytest

# Démarrage du serveur API FastAPI
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Documentation Swagger UI interactive : `http://localhost:8000/docs`

---

## 📋 Endpoints Propriétaires & Contrats

### 1. `POST /depistage`
Reçoit les mesures de l'application mobile ou du module Vision AI et exécute le pipeline 4 étapes.

**Exemple Payload Enfant :**
```json
{
  "population": "enfant",
  "mesures": {
    "pb": 112.0,
    "pb_source": "vision_ai",
    "oedemes_bilateraux": false
  },
  "agent_id": "AGENT_COMMUNAUTAIRE_01",
  "centre_id": "CENTRE_SANTE_OUAGA",
  "mode_saisie": "ocr_photo"
}
```

**Exemple Payload Femme Enceinte :**
```json
{
  "population": "enceinte",
  "mesures": {
    "personne_id": "FEMME_8842",
    "hauteur_uterine": 22.0,
    "semaine_amenorrhee": 28
  },
  "agent_id": "SAGE_FEMME_02",
  "centre_id": "CENTRE_CPN_01",
  "mode_saisie": "mètre_ruban"
}
```

**Exemple Payload Personne Âgée :**
```json
{
  "population": "personne_agee",
  "mesures": {
    "score_mna_sf": 6
  },
  "agent_id": "AGENT_COMMUNAUTAIRE_03",
  "centre_id": "CENTRE_SANTE_OUAGA",
  "mode_saisie": "manuel"
}
```

**Réponse (201 Created) :**
```json
{
  "id": 1,
  "population": "enfant",
  "mesures": { "pb": 112.0, "oedemes_bilateraux": false },
  "date": "2026-09-26T08:39:00Z",
  "agent_id": "AGENT_COMMUNAUTAIRE_01",
  "centre_id": "CENTRE_SANTE_OUAGA",
  "classification": "sévère",
  "orientation_declenchee": true,
  "mode_saisie": "ocr_photo",
  "recommandation": "Transfert immédiat pour prise en charge médicale et nutritionnelle spécialisée."
}
```

---

### 2. `GET /depistage/{id}`
Récupère les détails d'un dépistage enregistrés en base.

---

### 3. `GET /alertes`
Retourne la liste ordonnée des dépistages sévères ou nécessitant une orientation urgente.

---

### 4. `GET /seuils` & `PUT /seuils`
Lecture et mise à jour dynamique des seuils protocolaires (aucun seuil codé en dur).

**Exemple PUT `/seuils` :**
```json
{
  "population": "enfant",
  "type_mesure": "pb_severe",
  "nouvelle_valeur": 110.0,
  "agent_id": "SUPERVISEUR_OMS",
  "version_protocole": "OMS 2025-V2"
}
```
*Toute modification est automatiquement enregistrée dans `JournalValidationSeuils`.*
