# NUTRI-DÉPIST : application mobile (Fanta)

Expo / React Native (TypeScript, Expo Router). Parcours SÉLECTION → MESURE → RÉSULTAT en saisie manuelle pour les 3 populations, plus l'historique local et la courbe de suivi de grossesse.

## Lancer

```bash
npm install
npx expo start            # puis « a » (Android) ou « w » (web)
```

| Variable | Rôle | Défaut |
|---|---|---|
| `EXPO_PUBLIC_USE_MOCK` | `false` pour utiliser la vraie API d'Alya | `true` (mock) |
| `EXPO_PUBLIC_API_URL` | URL de l'API | `http://localhost:8000` |

Téléphone branché en USB : `adb reverse tcp:8000 tcp:8000` puis `adb reverse tcp:8081 tcp:8081` (l'app appelle alors `localhost`).

Qualité : `npm run typecheck`, `npx expo lint`, `npm test`.

## Structure

- `src/app/` : écrans (sélection, enfant, femme-enceinte, personne-agee, resultat, historique)
- `src/services/` : `api.ts` (seul point d'entrée réseau), `mockDepistage.ts`, `plages.ts`, `mna.ts`, `presentation.ts`, `depistage.ts`
- `src/data/historique.ts` : adaptateur au-dessus du module de Rasmata (`sync/`, importé sans modification). SQLite sur mobile, mémoire sur le web.
- `sync/` : stockage local et synchronisation (Rasmata, branche `rasmata/offline-sync`). Ne pas modifier ici.
- `src/theme/` : échelle dynamique. Aucune taille d'écran n'est codée en dur : polices, espacements, rayons, cibles tactiles et largeur de contenu sont calculés à partir de la largeur et de la hauteur réelles de la fenêtre.

## Contrat d'API utilisé (aligné sur `alya/engine-api`)

`POST /depistage` : `{ population, mesures, agent_id, centre_id, mode_saisie: "manuel" }`

| Population | Valeur | Champs de `mesures` (unités) |
|---|---|---|
| Enfant | `enfant` | `pb` (mm), `pb_source`, `poids` (kg), `taille` (cm), `oedemes_bilateraux` (booléen), `oedemes_source` |
| Femme enceinte | `enceinte` | `personne_id`, `date_cpn`, `hauteur_uterine` (cm), `hauteur_uterine_source`, `pb` (mm), `semaine_amenorrhee` (entier) |
| Personne âgée | `personne_agee` | `score_mna_sf` (0-14), `perimetre_mollet` (cm), `pb_optionnel` (mm), `perte_poids_recente` (booléen) |

Erreur hors plage : HTTP 422 `{ "detail": "Erreur de mesure: La mesure 'pb' (900) est hors de la plage physiologique valide [50.0, 350.0]…" }`. Le champ est extrait du message ; les plages sont aussi contrôlées localement avant l'appel (`services/plages.ts`, miroir de `PHYSIOLOGICAL_RANGES`) pour fonctionner hors ligne.

## Décisions et points à valider avec l'équipe

1. **Œdèmes « Incertain »** : l'ASC choisit Oui / Non / Incertain, mais l'API n'accepte qu'un booléen. `Incertain` est envoyé comme `true` (orientation prudente) et un avertissement demande de confirmer par le test de pression (`services/mappings.ts`). À trancher avec Alya.
2. **Écart de hauteur utérine** (`ecart_suivi_rapproche`) : l'API joint une recommandation de « transfert immédiat », contraire à la règle du cahier des charges (suivi rapproché, jamais un diagnostic). L'écran affiche un texte de suivi rapproché à la place (`actionAffichee`). Demander à Alya d'ajuster la recommandation côté serveur.
3. **`date_cpn`** : envoyée par l'app mais ignorée par l'API (heure serveur). Demander à Alya de la prendre en compte.
4. **Classification personne âgée** : le moteur ignore `perimetre_mollet` et `perte_poids_recente` (seuls `score_mna_sf` et `pb_optionnel` comptent). Le cas de référence du cahier des charges (§5.5) n'est donc pas couvert.
5. **Erreur 422** : demander un champ dédié (`{ champ: "pb" }`) au lieu d'extraire le nom du champ du texte.
6. **MNA-SF** : questionnaire à 6 items avec score calculé (question F via le périmètre du mollet), ou saisie directe du score.

## Hors ligne (intégration de `sync/`)

Flux d'un dépistage (`src/services/depistage.ts`) :

1. Contrôle local des plages (rejet immédiat, sans réseau).
2. **En ligne** : l'API répond (classification officielle + recommandation) ; le dépistage est enregistré comme *synchronisé* dans la base de Rasmata, sans renvoi.
3. **Hors ligne** (serveur injoignable ou sans réponse sous 8 s) : `enregistrerDepistage` de Rasmata écrit en local, classification **provisoire** (`localClassifier.js`), envoi automatique au retour du réseau. L'écran de résultat l'indique clairement ; le badge « en attente de synchronisation » et le bouton « Synchroniser maintenant » (historique) complètent le dispositif. Une relance automatique a lieu chaque minute tant que des dépistages attendent.
4. Une erreur du serveur (valeur hors plage, réponse inattendue) n'est jamais mise en file d'attente : elle est renvoyée à l'écran.

Les informations propres à l'application (code de la personne, œdèmes incertains, message et recommandation du serveur) sont dans la table annexe `depistage_extras`, liée par `local_id` : le schéma de Rasmata n'est pas modifié.

### Constats pour Rasmata (`mobile/sync`)

1. **Faux doublons** : la règle « même agent, même centre, même population, moins de 15 min » se déclenche à chaque campagne (deux enfants d'affilée). Côté app, l'alerte n'est conservée que si les mesures sont identiques (`memeEvenement`) ; à corriger à la source en comparant aussi les mesures.
2. **Deux synchronisations simultanées** possibles (`enregistrerDepistage`, retour du réseau, bouton manuel) : elles lisent les mêmes lignes « en attente » et peuvent envoyer deux fois. Prévoir un verrou dans `syncPendingDepistages`.
3. **Pas de relance** si le réseau est présent mais le serveur injoignable (aucune transition détectée) : l'app relance chaque minute (`useSynchronisation`).
4. **Message et recommandation** du serveur ne sont pas conservés : ils sont perdus après synchronisation d'une entrée hors ligne.
5. **Classifieur local** différent du moteur d'Alya : personne âgée « score ≤ 6 » contre « ≤ 7 » chez Alya ; grossesse : orientation `false` contre `true`, et `à_confirmer_en_ligne` hors 20-34 SA alors que le serveur classe toutes les semaines.

### Constats pour Lionel (`mobile/vision`, non intégré)

- Les écrans utilisent l'API de React Navigation (`navigation.navigate`, `route.params`) ; l'app utilise Expo Router.
- `PBCaptureScreen` importe `Camera` / `CameraType` de `expo-camera` (API historique, à vérifier avec le SDK 57 qui expose `CameraView`) ; `expo-camera` n'est pas installé.
- Les écrans attendent un `depistage_id` avant la capture, alors qu'un dépistage n'existe qu'après validation.
- Souhaitable : un contrat simple, par exemple `onValider({ pb_mm, methode: 'camera' })`, indépendant de la navigation, pour brancher son module dans la saisie Enfant (`pb_source: 'camera'`, `mode_saisie: 'vision'`).

## Limites connues (non traitées)

- **Données non chiffrées au repos** : la base SQLite et le code ou nom des personnes sont en clair sur le téléphone, alors que le cahier des charges (§9.4) exige un chiffrement. À traiter avec Rasmata (SQLCipher).
- **Pas d'authentification** : `agent_id` et `centre_id` sont des constantes de démonstration (`src/constants/config.ts`). La détection de doublons et l'isolation par centre n'ont donc pas de sens réel tant qu'il n'y a pas de compte agent.
- **Vision par ordinateur** : non intégrée (voir plus haut).
- **Web** : l'historique n'y est conservé qu'en mémoire et il n'y a pas de mode hors ligne (démonstration seulement).
- **Vérifié sur Android (TECNO KM6, Android 15) uniquement** ; iOS, le mode « grande police » du système et un build installable n'ont pas été testés.
- **Code de la patiente** en texte libre : une faute de frappe crée une seconde patiente dans le suivi de grossesse.
- Les tests de `sync/` (Jest, Rasmata) ne sont pas exécutés ici ; `npm test` ne couvre que `src/`.
