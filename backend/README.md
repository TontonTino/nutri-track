# NUTRI-TRACK — Backend

Fondation Flask / SQLite du prototype NUTRI-TRACK (données, API de base). Le moteur de décision NUTRI-SWITCH (calcul du Stock Mobilisable, JCM, recherche de donneur) est développé séparément et consommera ces modèles/API.

## Installation

```bash
cd backend
python -m venv venv
```

Windows (PowerShell) :
```powershell
.\venv\Scripts\Activate.ps1
```
macOS/Linux :
```bash
source venv/bin/activate
```

Puis :
```bash
pip install -r requirements.txt
```

## Lancement

```bash
python run.py
```

Au démarrage, le script :
1. crée `../database/nutri_track.db` si elle n'existe pas ;
2. crée les tables (`centres`, `stocks`, `distributions`, `transferts`, `historique`) ;
3. insère les centres de démonstration (Kaya Nord, Kaya Sud, Kaya Centre) s'ils sont absents.

Le serveur écoute sur `http://127.0.0.1:5000`.

## Tests

```bash
pytest -q
```

## Documentation des endpoints

Voir [`docs/api.md`](../docs/api.md) à la racine du dépôt.

## Structure

```
backend/
├── app/
│   ├── __init__.py       # application factory Flask
│   ├── extensions.py     # instance SQLAlchemy
│   ├── models.py         # Centre, Stock, Distribution, Transfert, Historique
│   ├── seed.py           # données de démonstration
│   └── routes/
│       ├── centres.py
│       ├── stocks.py
│       └── distributions.py
├── tests/
│   └── test_api.py
├── conftest.py           # fixtures pytest (app/client de test)
├── config.py
├── run.py
└── requirements.txt
```
