# mobile/sync — Stockage local & synchronisation (Rasmata)

## Ce que ce module fait

- Écrit **toujours en local d'abord** (SQLite via `expo-sqlite`) quand un dépistage est
  validé, qu'on soit en ligne ou non.
- Calcule une **classification provisoire hors-ligne** (`localClassifier.js`) à partir des
  seuils critiques documentés dans `docs/CONTRAT_INTERFACE.md`, pour que l'agent ait un
  retour immédiat même sans réseau. Cette classification est remplacée par celle du
  serveur (`classification_serveur`) dès que la synchronisation réussit.
- Détecte les doublons probables (même agent, même centre, même population, saisies à
  moins de 15 min d'écart) et **marque les deux entrées** (`conflit_ambigu = 1`) sans
  jamais en supprimer ou en écraser une.
- Synchronise automatiquement dès que le réseau revient (`useOfflineSync`), sans bloquer
  l'écran, et retente entrée par entrée (une panne sur l'une n'empêche pas les autres).

## Comment l'intégrer (Fanta / Lionel)

Un seul appel après validation d'un dépistage, peu importe l'écran :

```js
import { enregistrerDepistage } from '../sync';

const resultat = await enregistrerDepistage({
  population: 'enfant', // 'enfant' | 'enceinte' | 'personne_agee'
  mesures: { pb: 112, oedemes_bilateraux: false }, // même format que POST /depistage
  agent_id: agentConnecte.id,
  centre_id: agentConnecte.centre_id,
  mode_saisie: 'manuel', // 'vision' si ça vient du module de Lionel
});
// resultat = { local_id, classification, orientation_declenchee, conflit_ambigu }
```

Pour l'historique (doit marcher hors-ligne) :

```js
import { getHistorique } from '../sync';
const items = await getHistorique({ centre_id: agentConnecte.centre_id });
```

Une seule fois, en haut de l'app (`App.js`) :

```js
import { useOfflineSync, SyncStatusBadge } from './mobile/sync';

function App() {
  const { nombreEnAttente, enSynchronisation } = useOfflineSync();
  return (
    <>
      <SyncStatusBadge count={nombreEnAttente} syncing={enSynchronisation} />
      {/* ... navigation ... */}
    </>
  );
}
```

## Dépendances à ajouter au `package.json`

```
expo-sqlite
@react-native-community/netinfo
```

(`npx expo install expo-sqlite @react-native-community/netinfo` une fois le projet Expo
de Fanta en place.)

## Choix assumés — à valider vite avec l'équipe

1. **expo-sqlite plutôt que WatermelonDB** : plus rapide à mettre en place sans code
   natif, suffisant pour une file d'attente + un historique. WatermelonDB serait plus
   robuste (réactivité, sync engine intégré) mais demande de l'autolinking — trop risqué
   en 2 jours. Toute la logique métier est isolée dans `syncQueue.js` : une migration
   ultérieure resterait localisée.
2. **Fenêtre de conflit = 15 minutes** (`FENETRE_CONFLIT_MS` dans `syncQueue.js`) : à
   ajuster selon le protocole terrain réel si l'équipe a un chiffre plus précis.
3. **Classification locale = provisoire, sur seuils dupliqués** (`localClassifier.js`) :
   si Alya change un seuil via `PUT /seuils` pendant le hackathon, ce fichier n'est PAS
   mis à jour automatiquement (pas de réseau hors-ligne par définition). Le champ
   `classification_locale_provisoire` reste à 1 tant que le serveur n'a pas confirmé —
   **les écrans doivent afficher clairement "provisoire" tant que ce flag est à 1**.
4. **`SynchronisationLog` est ici une table locale uniquement** (le contrat ne précise
   pas si elle doit aussi exister côté backend). Si le jury/l'équipe veut un miroir
   serveur, il faudra un nouvel endpoint — à décider ensemble avant de toucher
   `docs/CONTRAT_INTERFACE.md`.
5. **`conflit_ambigu` n'est pas envoyé au serveur** : `DepistageCreate` (schemas.py côté
   Alya) n'a pas de champ pour ça. Les deux entrées en conflit sont synchronisées comme
   deux dépistages distincts ; le signalement de l'ambiguïté ne vit que sur l'appareil
   pour l'instant. À évoquer avec Alya si un signalement "doublon" doit remonter au
   backend pour la démo.

## Tests (Volet 2)

Les tests utilisent Vitest et une fausse implémentation de `expo-sqlite` en mémoire
(pas besoin d'un vrai appareil / simulateur). Depuis `mobile/sync` :

```bash
npx vitest run --config vitest.config.mts
```
