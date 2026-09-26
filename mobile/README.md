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
- `src/data/historique.ts` : historique local (SQLite sur mobile, mémoire sur le web). Interface étroite, pensée pour être remplacée ou étendue par la synchronisation (`mobile/sync/`).
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
