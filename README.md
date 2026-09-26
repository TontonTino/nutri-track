# NUTRI-DÉPIST 🩺📱
**IDEAthon — Digital Impact Challenge 2026 — Groupe Nutriset**
**Établissement :** ISGE-BF
**Équipe :**
- **Alya** (KIEMDE Banyala Latifa) — Moteur de classification + Backend (FastAPI)
- **Fanta** (KABA Amane Chadine) — Application mobile, écrans et saisie manuelle (React Native)
- **Lionel** (NITIEMA Marie Auguste) — Vision par ordinateur + Démonstration/Pitch
- **Rasmata** (KABRE) — Mode hors-ligne, synchronisation, tests, documentation

---

## 📌 Présentation

NUTRI-DÉPIST est une application mobile hors-ligne de dépistage nutritionnel communautaire pour trois populations à risque au Burkina Faso : enfants (6-59 mois), femmes enceintes/allaitantes, personnes âgées. Le protocole s'appuie sur des mesures anthropométriques validées (PB, hauteur utérine, MNA-SF), avec une assistance optionnelle par vision par ordinateur (prototype, flux d'interaction fonctionnel, non validé cliniquement).

Principe directeur : **l'IA assiste, l'ASC valide, le protocole classe, le professionnel de santé prend en charge.**

## 🏗️ Stack technique

| Composant | Choix |
|---|---|
| Application mobile | React Native |
| Vision par ordinateur (client) | Traitement d'image embarqué (heuristique MVP) |
| Base locale | WatermelonDB / SQLite |
| Backend / synchronisation | FastAPI (Python) |
| Base centrale | PostgreSQL |

## 📂 Structure du dépôt

```
nutri-depist/
├── backend/        # Alya — moteur de classification + API FastAPI
├── mobile/         # Fanta — écrans, saisie manuelle, historique
│                   # Lionel — module vision par ordinateur (mobile/vision/)
│                   # Rasmata — stockage local + synchronisation (mobile/sync/)
├── docs/
│   └── CONTRAT_INTERFACE.md   # Contrat de données et d'API — source de vérité, ne pas modifier seul
└── README.md
```

## 🌿 Branches actives

- `alya/engine-api`
- `fanta/mobile-screens`
- `lionel/vision`
- `rasmata/offline-sync`

Les branches `archive/nutri-track-*` contiennent le code de l'ancien projet NUTRI-TRACK (rééquilibrage de stocks), conservé pour référence mais non utilisé dans NUTRI-DÉPIST.

## 🧪 Règle d'or

Le fichier `docs/CONTRAT_INTERFACE.md` (noms de tables, champs, endpoints) est la seule source de vérité. Personne ne le modifie seul sans prévenir les 3 autres avant de push.
