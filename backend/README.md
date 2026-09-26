# NUTRI-DÉPIST Backend & Moteur de Classification

Cerveau du système de dépistage nutritionnel communautaire pour la prise en charge rapide des enfants (6-59 mois), femmes enceintes et personnes âgées. Conforme au **Protocole National PCIMA Burkina Faso (2014)** et aux **directives OMS**.

## 🌿 Branche Git
`fix/alya-restructure` (ou `alya/engine-api`)

## 🚀 Démarrage Rapide

```bash
# Se placer dans le dossier backend
cd backend

# Installation des dépendances
pip install -r requirements.txt

# Lancement des tests unitaires et d'intégration
python -m pytest tests

# Démarrage du serveur API FastAPI
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Documentation Swagger UI interactive : `http://localhost:8000/docs`

---

## 📋 Endpoints Propriétaires & Contrats

### 1. `POST /capture-vision` (Module Vision AI — Lionel & Rasmata)
Reçoit la mesure estimée par le module Vision par ordinateur (heuristique MVP / caméra).
Prépare la capture en attente de validation par l'Agent de Santé Communautaire (ASC).
*Principe : L'IA assiste, l'ASC valide.*

**Payload d'entrée :**
```json
{
  "population": "enfant",
  "type_mesure": "pb",
  "valeur_estimee": 112.0,
  "score_confiance": 0.95,
  "agent_id": "AGENT_COMMUNAUTAIRE_01",
  "centre_id": "CENTRE_SANTE_OUAGA",
  "image_metadata": { "filename": "muac_photo_01.jpg" }
}
```

---

### 2. `POST /capture-vision/{id}/validation`
L'Agent de Santé Communautaire (ASC) **valide ou corrige** la valeur suggérée par la Vision AI.
Une fois validée, l'API exécute automatiquement le pipeline de classification 4 étapes et enregistre le dépistage officiel (`mode_saisie = "ocr_photo"`).

**Payload de validation :**
```json
{
  "valeur_validee": 112.0,
  "statut_validation": "valide",
  "agent_id": "AGENT_COMMUNAUTAIRE_01",
  "oedemes_bilateraux": false
}
```

---

### 3. `POST /depistage` (Saisie directe / Manuel)
Reçoit les mesures de l'application mobile et exécute le pipeline 4 étapes.

**Exemple Payload Enfant :**
```json
{
  "population": "enfant",
  "mesures": {
    "pb": 112.0,
    "pb_source": "manuel",
    "oedemes_bilateraux": false
  },
  "agent_id": "AGENT_COMMUNAUTAIRE_01",
  "centre_id": "CENTRE_SANTE_OUAGA",
  "mode_saisie": "manuel"
}
```

---

### 4. `GET /depistage/{id}`
Récupère les détails d'un dépistage enregistrés en base.

---

### 5. `GET /alertes`
Retourne la liste ordonnée des dépistages sévères ou nécessitant une orientation urgente.

---

### 6. `GET /seuils` & `PUT /seuils`
Lecture et mise à jour dynamique des seuils protocolaires (aucun seuil codé en dur).

---

### 7. `GET /health` & `GET /stats`
Diagnostics système, état de la base, Uptime, et agrégats statistiques pour les tableaux de bord.

---

### 8. `GET /alertes/export/csv` & `GET /alertes/{id}/fiche-orientation`
Exports CSV des alertes et Fiche d'orientation imprimable (HTML/PDF) avec le Numéro Unique MA au format officiel Burkina Faso (`RBM/DDG/CSPS/2026/001`).
