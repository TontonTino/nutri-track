# NUTRI-TRACK — API Backend (v0, MVP)

Base URL locale : `http://127.0.0.1:5000`

Toutes les réponses sont en JSON.

## Santé

### `GET /api/health`
Vérifie que le serveur répond.

**Réponse 200**
```json
{ "status": "ok" }
```

## Centres

### `GET /api/centres`
Liste tous les centres avec leur stock courant imbriqué.

**Réponse 200**
```json
[
  {
    "id": 1,
    "nom": "Kaya Nord",
    "created_at": "2026-09-22T21:37:26.573237",
    "stock": {
      "id": 1,
      "centre_id": 1,
      "stock_physique": 100.0,
      "stock_reserve": 40.0,
      "stock_securite": 20.0,
      "consommation_quotidienne": 8.0,
      "updated_at": "2026-09-22T21:37:26.579021"
    }
  }
]
```

### `GET /api/centres/<id>`
Détail d'un centre. `404` si l'id est inconnu.

### `POST /api/centres`
Crée un centre (et son stock initial à zéro, ou avec les valeurs fournies).

**Body**
```json
{
  "nom": "Dori",
  "stock_physique": 0,
  "stock_reserve": 0,
  "stock_securite": 0,
  "consommation_quotidienne": 0
}
```
- `nom` requis. `400` si absent, `409` si le nom existe déjà.

## Stocks

### `GET /api/stocks`
Liste tous les stocks (un par centre).

### `GET /api/stocks/<centre_id>`
Stock courant d'un centre. `404` si le centre n'a pas de stock enregistré.

### `PUT /api/stocks/<centre_id>`
Saisie/mise à jour du stock d'un centre (étape **SEE** du simulateur USSD).
Crée automatiquement l'entrée si elle n'existe pas encore. Journalise l'événement dans l'historique.

**Body** (tous les champs optionnels, seuls ceux fournis sont mis à jour)
```json
{
  "stock_physique": 90,
  "stock_reserve": 40,
  "stock_securite": 20,
  "consommation_quotidienne": 8
}
```

## Distributions / consommation

### `GET /api/distributions?centre_id=<id>`
Liste les distributions, filtrable par centre (`centre_id` optionnel).

### `POST /api/distributions`
Déclare une distribution/consommation pour un centre (étape **SEE**). Décrémente automatiquement `stock_physique` du centre et journalise l'événement.

**Body**
```json
{ "centre_id": 1, "quantite": 10 }
```
- `centre_id` et `quantite` requis, `quantite` doit être > 0. `400` sinon, `404` si le centre n'existe pas.

## Transferts

### `GET /api/transferts?statut=<propose|valide|refuse>`
Liste les transferts, filtrable par statut (paramètre optionnel).

### `GET /api/transferts/<id>`
Détail d'un transfert. `404` si l'id est inconnu.

### `POST /api/transferts`
Enregistre une **proposition** de transfert (étape **DECIDE**, calculée par NUTRI-SWITCH). Ne déplace aucun stock : le transfert reste au statut `propose` tant qu'il n'est pas explicitement validé ou refusé.

**Body**
```json
{ "centre_donneur_id": 2, "centre_receveur_id": 1, "quantite": 72 }
```
- Les trois champs sont requis. `400` si un champ manque, si `quantite <= 0`, ou si donneur = receveur.

**Réponse 201**
```json
{
  "id": 1,
  "centre_donneur_id": 2,
  "centre_receveur_id": 1,
  "quantite": 72.0,
  "statut": "propose",
  "date_creation": "2026-09-22T21:52:42.279964",
  "date_decision": null,
  "decide_par": null
}
```

### `PUT /api/transferts/<id>/valider`
Validation explicite du MCD (étape **ACT**). C'est la seule route qui déplace réellement du stock : décrémente `stock_physique` du donneur, incrémente celui du receveur, à condition que le donneur ait un stock physique suffisant.

**Body** (optionnel)
```json
{ "decide_par": "Dr. Ouedraogo" }
```
- `409` si le transfert n'est plus au statut `propose`, ou si le stock du donneur est insuffisant.

### `PUT /api/transferts/<id>/refuser`
Refus explicite du MCD. Aucun mouvement de stock. `409` si le transfert n'est plus au statut `propose`.

**Body** (optionnel)
```json
{ "decide_par": "Dr. Ouedraogo" }
```

## Modèle de données

| Table | Champs clés |
|---|---|
| `centres` | id, nom, created_at |
| `stocks` | id, centre_id (1-1), stock_physique, stock_reserve, stock_securite, consommation_quotidienne, updated_at |
| `distributions` | id, centre_id, quantite, date |
| `transferts` | id, centre_donneur_id, centre_receveur_id, quantite, statut (propose/valide/refuse), date_creation, date_decision, decide_par |
| `historique` | id, type_evenement, centre_id, description, date |
