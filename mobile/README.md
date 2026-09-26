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

Backend d'Alya (branche `fix/alya-restructure`, dossier `backend/`) : `pip install -r requirements.txt` puis `uvicorn app.main:app --port 8000`.

Qualité : `npm run typecheck`, `npx expo lint`, `npm test`. Après toute modification de `metro.config.js`, redémarrer Metro (`npx expo start -c`).

## Structure

- `src/app/` : écrans (sélection, enfant, femme-enceinte, personne-agee, resultat, historique)
- `src/services/` : `api.ts` (seul point d'entrée réseau), `mockDepistage.ts`, `plages.ts`, `mna.ts`, `presentation.ts`, `depistage.ts`
- `src/data/historique.ts` : adaptateur au-dessus du module de Rasmata (`sync/`, importé sans modification). SQLite sur mobile, mémoire sur le web.
- `sync/` : stockage local et synchronisation (Rasmata, branche `rasmata/offline-sync`). Ne pas modifier ici.
- `vision/` : capture guidée du PB (Lionel, branche `lionel/vision`). Ne pas modifier ici ; adapté par `metro-aliases.js` et `src/vision/`.
- `src/theme/` : échelle dynamique. Aucune taille d'écran n'est codée en dur : polices, espacements, rayons, cibles tactiles et largeur de contenu sont calculés à partir de la largeur et de la hauteur réelles de la fenêtre.

## Contrat d'API utilisé (vérifié contre `fix/alya-restructure`, moteur 1.3.0)

`POST /depistage` : `{ population, mesures, agent_id, centre_id, mode_saisie: "manuel" }`

| Population | Valeur | Champs de `mesures` (unités) |
|---|---|---|
| Enfant | `enfant` | `pb` (mm), `pb_source`, `poids` (kg), `taille` (cm), `oedemes_bilateraux` (booléen), `oedemes_source` |
| Femme enceinte | `enceinte` | `personne_id`, `date_cpn`, `hauteur_uterine` (cm), `hauteur_uterine_source`, `pb` (mm), `semaine_amenorrhee` (entier) |
| Personne âgée | `personne_agee` | `score_mna_sf` (0-14), `perimetre_mollet` (cm), `pb_optionnel` (mm), `perte_poids_recente` (booléen) |

Erreur hors plage : HTTP 422 `{ "detail": "Erreur de mesure: La mesure 'pb' (900) est hors de la plage physiologique valide [50.0, 350.0]…" }`. Le champ est extrait du message ; les plages sont aussi contrôlées localement avant l'appel (`services/plages.ts`, miroir de `PHYSIOLOGICAL_RANGES`) pour fonctionner hors ligne.

## Décisions et points à valider avec l'équipe

1. **Œdèmes « Incertain » (décidé)** : l'API n'accepte qu'un booléen, et envoyer un doute comme « oui » classait sévère un enfant peut-être sain. « Incertain » n'est donc plus une réponse finale : il affiche le guide du test de pression (`components/AideTestPression.tsx`, protocole PCIMA : pouce 3 secondes sur le dessus des deux pieds, un creux sur un seul pied ne compte pas) et **bloque la validation** tant que l'agent n'a pas répondu Oui ou Non. Aucun « Incertain » n'est jamais envoyé au serveur (`services/mappings.ts`). Alya n'a rien à modifier.
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

## Caméra : lecture assistée du brassard (par défaut)

Le formulaire Enfant propose « Photographier le brassard (contrôle) » (`src/app/brassard.tsx`). Principe : le **brassard PB** est l'instrument de référence ; la caméra en photographie la bande, **l'agent tape la valeur lue**, et l'app contrôle que la couleur visible sur la photo (rouge < 115 mm, jaune 115-124 mm, vert ≥ 125 mm) correspond à cette valeur, pour repérer une erreur de lecture ou de frappe. Trois étapes, sans objet de calibration :

1. cadrer la fenêtre de lecture du brassard dans le rectangle et prendre la photo ;
2. taper la valeur lue (l'app affiche la couleur vue et la zone de la valeur, et alerte en cas d'incohérence, sans jamais bloquer) ;
3. « Utiliser cette valeur » : le PB remplit le formulaire.

Garanties : aucune estimation de l'IA n'entre dans le classement (seule la valeur lue par l'agent) ; le contrôle est indicatif ; la photo est analysée sur le téléphone puis **effacée** (reprise, validation ou sortie de l'écran). La source reste `pb_source: "manuel"` ; la traçabilité du contrôle part dans `mesures` : `pb_controle_photo` (`coherent` / `incoherent` / `non_detecte`) et `pb_couleur_detectee`.

Pourquoi ce choix : l'estimation par calibration du module de Lionel (ci-dessous) suppose une **largeur de bras constante** (60 % de l'écran) : la carte convertit cette constante en cm, mais le bras n'est jamais mesuré. Une photo de profil ne donne d'ailleurs pas un PB fiable sans capteur de profondeur. La détection de couleur est une aide : elle ne détecte rien plutôt que de deviner quand la bande est absente ou mêlée, et peut se tromper sous une lumière colorée.

## Estimation par calibration (module de Lionel, désactivée par défaut)

`EXPO_PUBLIC_VISION_CALIBRATION=true` réaffiche le bouton « Estimer par calibration (prototype) ».

### Intégration de `vision/`

Le module de Lionel (`vision/`, importé **sans modification**) est hébergé dans l'app : le formulaire Enfant propose « Mesurer avec la caméra », qui ouvre ses écrans Capture → Calibration → Confirmation. Le PB **confirmé ou corrigé par l'agent** revient dans le champ PB (jamais une estimation brute), puis le flux normal enregistre **un seul** dépistage (en ligne ou hors ligne).

Comment c'est rendu compatible sans toucher à ses fichiers (`metro.config.js` + `metro-aliases.js`, actifs uniquement pour les fichiers de `vision/`) :

| Problème | Solution |
|---|---|
| Ses écrans utilisent React Navigation (`navigation.navigate`, `route.params`) | `src/vision/navigation.ts` + `EcranVision.tsx` traduisent vers Expo Router (routes `src/app/vision/*`) |
| `expo-camera` : `Camera` / `CameraType` n'existent plus comme composant / valeur dans le SDK 57 | `src/vision/compat/expoCamera.tsx` (au-dessus de `CameraView`) |
| Son client réseau vise un serveur factice hors mode dev ; côté Alya, `PUT /capture-vision/{id}/validation` **crée un dépistage** (double comptage avec `POST /depistage`) | `src/vision/compat/captureVisionApiLocale.ts` : la décision reste sur le téléphone (vision utilisable hors ligne) |

Traçabilité : `pb_source: "vision_ai"` (convention d'Alya), `mode_saisie: "vision"` (documenté par Rasmata), et dans `mesures` : `pb_estime_vision`, `pb_score_confiance`, `pb_statut_validation`, `pb_methode_mesure` (estimation de l'IA distincte de la valeur validée). Une valeur simplement tapée à la main sur l'écran de confirmation reste une saisie **manuelle**.

### Demandes pour Lionel

- La plage de correction de sa confirmation (60-400 mm) diffère de celle du serveur (50-350 mm) ; l'app rejette au moment de valider le formulaire.
- Son écran envoie `score_confiance: 0` en saisie directe (ignoré côté app : traité comme « pas d'estimation »).
- Ses styles utilisent des tailles fixes ; ils ne suivent pas l'échelle dynamique de l'app.
- Quand il adaptera son module (Expo Router, `CameraView`, sans appel à `/capture-vision` avant le dépistage), `metro-aliases.js` pourra être supprimé.

### Demandes pour Alya

- `PUT /capture-vision/{id}/validation` crée un dépistage : non utilisé par l'app (double comptage, pas de hors ligne). Le lien capture-dépistage est porté par `mesures` (voir ci-dessus).
- Classement hors ligne : l'app aligne le résultat provisoire de Rasmata sur son moteur (`src/data/alignementLocal.ts`, mêmes seuils par défaut : MNA-SF ≤ 7, PB adulte < 180 mm, PB enceinte < 230 mm). Si ces seuils changent côté serveur (`PUT /seuils`), les mettre à jour ici.

## Points de couplage entre modules

| Module | Ce que l'app utilise | Où | Modifiable sans casser l'app |
|---|---|---|---|
| Alya (API) | `POST /depistage`, format des erreurs 422, champs de `mesures` | `src/services/api.ts`, `src/types/depistage.ts`, `src/services/plages.ts` | Oui, si le contrat ci-dessus est conservé |
| Rasmata (`sync/`) | `initDatabase`, `getDb`, `enregistrerDepistage`, `getHistorique`, `useOfflineSync`, `classifierHorsLigne` | `src/data/historique.ts`, `src/data/useSynchronisation.ts` | Oui, si ces exports et la table `depistages_locaux` sont conservés |
| Lionel (`vision/`) | Écrans `PBCaptureScreen`, `CalibrationScreen`, `ConfirmationScreen`, `CaptureFailScreen`, appels `postCaptureVision` / `putCaptureValidation` | `src/app/vision/*`, `src/vision/*`, `metro-aliases.js` | Oui, si les noms d'écrans, leurs paramètres de navigation et ces deux fonctions sont conservés |

## Limites connues (non traitées)

- **Données non chiffrées au repos** : la base SQLite et le code ou nom des personnes sont en clair sur le téléphone, alors que le cahier des charges (§9.4) exige un chiffrement. À traiter avec Rasmata (SQLCipher).
- **Pas d'authentification** : `agent_id` et `centre_id` sont des constantes de démonstration (`src/constants/config.ts`). La détection de doublons et l'isolation par centre n'ont donc pas de sens réel tant qu'il n'y a pas de compte agent.
- **Caméra** : la capture guidée et la calibration n'ont été exercées que par le chemin de saisie manuelle de secours (navigateur, sans caméra). À valider sur un téléphone avec un vrai objet de calibration.
- **Web** : l'historique n'y est conservé qu'en mémoire et il n'y a pas de mode hors ligne (démonstration seulement).
- **Vérifié sur Android (TECNO KM6, Android 15) uniquement** ; iOS, le mode « grande police » du système et un build installable n'ont pas été testés.
- **Code de la patiente** en texte libre : une faute de frappe crée une seconde patiente dans le suivi de grossesse.
- Les tests de `sync/` (Jest, Rasmata) ne sont pas exécutés ici ; `npm test` ne couvre que `src/`.
