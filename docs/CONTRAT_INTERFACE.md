# Contrat d'interface — NUTRI-DÉPIST

Source de vérité unique pour les 4 modules. Toute modification de ce fichier doit être annoncée aux 3 autres avant push (voir §16 du cahier des charges).

## Modèle de données (Annexe A du cahier des charges)

- `Depistage(id, population, mesures, date, agent_id, centre_id, classification, orientation_declenchee, mode_saisie)`
- `MesureEnfant(depistage_id, pb, pb_source, poids, taille, oedemes_bilateraux, oedemes_source)`
- `SuiviGrossesse(id, personne_id, date_cpn, hauteur_uterine, hauteur_uterine_source, pb, semaine_amenorrhee, hauteur_uterine_attendue, ecart_croissance_foetale)`
- `MesurePersonneAgee(depistage_id, perimetre_mollet, pb_optionnel, perte_poids_recente, score_mna_sf)`
- `CaptureVision(id, depistage_id, type_mesure[pb|oedeme], image_ref, score_qualite, valeur_estimee, score_confiance, valeur_validee, methode_mesure, agent_validation_id, date_validation, statut[confirmee|corrigee|rejetee])`
- `Seuils(population, type_mesure, valeur_seuil, version_protocole, date_application)` — jamais de seuil codé en dur ailleurs
- `SynchronisationLog(depistage_id, date_saisie_locale, date_synchronisation)`
- `JournalValidationSeuils(id, seuil_id, ancienne_valeur, nouvelle_valeur, agent_id, date)`

## Endpoints API (propriétaire : Alya, sauf capture-vision détaillé ci-dessous)

| Endpoint | Rôle |
|---|---|
| `POST /depistage` | Enregistre un dépistage, retourne classification + orientation |
| `GET /depistage/{id}` | Détail d'un dépistage |
| `GET /alertes` | Cas sévères en attente d'orientation |
| `GET /seuils` | Configuration actuelle des seuils |
| `PUT /seuils` | Modifie les seuils |
| `POST /capture-vision` | Enregistre une capture (image_ref, score_qualite, valeur_estimee, score_confiance) avant validation |
| `PUT /capture-vision/{id}/validation` | Enregistre la décision de l'agent (confirmée/corrigée/rejetée) |

## Seuils métier (à lire dans la table `Seuils`, jamais en dur)

- Enfant : PB < 115 mm → sévère
- Personne âgée : MNA-SF = 6 → dénutrition probable
- Femme enceinte : écart hauteur utérine hors tolérance ±2-3 cm par rapport à la référence (hauteur utérine en cm ≈ semaine d'aménorrhée, 20-34 semaines) → suivi rapproché, jamais un diagnostic
- Règle transversale : un seul indicateur au niveau sévère suffit à classer sévère, jamais de moyenne entre indicateurs

## Répartition des modules

| Personne | Branche | Dossier | Responsabilité |
|---|---|---|---|
| Alya | `alya/engine-api` | `backend/` | Moteur de classification (pipeline Mesure → Interprétation → Classification → Orientation), API FastAPI |
| Fanta | `fanta/mobile-screens` | `mobile/` (racine) | Écrans de sélection, saisie manuelle (3 populations), résultat, historique |
| Lionel | `lionel/vision` | `mobile/vision/` | Capture guidée, calibration, estimation heuristique PB/œdèmes, écran de confirmation |
| Rasmata | `rasmata/offline-sync` | `mobile/sync/` | Stockage local, file de synchronisation, tests, documentation |

## Règle d'or

Aucune estimation issue de la vision par ordinateur n'entre dans la classification sans confirmation explicite de l'agent (écran de confirmation de Lionel obligatoire avant tout appel à `POST /depistage`).
