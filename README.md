# NUTRI-TRACK

Prototype réalisé dans le cadre de l'IDEAthon Digital Impact Challenge 2026 (ISGE-BF).

Anticipe les tensions de stock d'ATPE/RUTF entre centres de santé et propose des transferts locaux (NUTRI-SWITCH), validés par le Médecin Chef de District avant toute exécution.

## Structure

```
nutri-track/
├── backend/     # API Flask + SQLite (voir backend/README.md pour l'installation)
├── frontend/    # Interface web (dashboard MCD, simulateur USSD)
├── database/    # Fichier SQLite (généré automatiquement, non versionné)
└── docs/        # Documentation (endpoints API : docs/api.md)
```

## Démarrage rapide

Voir [`backend/README.md`](backend/README.md) pour lancer le backend, et [`docs/api.md`](docs/api.md) pour la référence des endpoints.
