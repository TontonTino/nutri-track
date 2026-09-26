# Rapport conceptuel — NUTRI-DÉPIST
*IDEAthon — Digital Impact Challenge 2026 — Groupe Nutriset — ISGE-BF*

> **Statut** : plan détaillé + sections rédigées là où le contenu est déjà stable
> (contrat d'interface, architecture technique). Les sections marquées `[À
> COMPLÉTER]` demandent un apport spécifique d'un membre de l'équipe (pitch/vision
> de Lionel, détails du moteur de classification d'Alya, retours terrain de Fanta
> sur les écrans). Cible : 10 pages de contenu max, hors annexes — chaque section
> a un budget de pages indicatif pour ne pas déborder.

---

## 1. Résumé exécutif *(½ page)*

`[À COMPLÉTER en dernier, une fois les autres sections stabilisées — 4-5 phrases :
problème, solution, ce qui est fonctionnel à la démo, impact visé.]`

## 2. Contexte et problème *(1,5 page)* — brouillon rédigé

Au Burkina Faso, la malnutrition aiguë reste un problème de santé publique majeur :
selon la Direction de la Nutrition, la prévalence nationale de la malnutrition aiguë
globale a été estimée à 9,7 %, dont 0,8 % de forme sévère (source : Burkina24, citant
la Direction de la Nutrition, 2023). Le pays s'est doté dès 2014 d'un **Protocole
National de Prise en Charge Intégrée de la Malnutrition Aiguë (PCIMA)**, structuré en
trois composantes : communautaire, centre de santé (UNS/UNTA), et référencement
hospitalier. Ce protocole repose explicitement sur l'implication communautaire pour le
dépistage précoce — c'est-à-dire sur les **Agents de Santé Communautaire (ASC)**, en
première ligne dans des zones souvent dépourvues de couverture réseau fiable.

Trois populations sont particulièrement vulnérables et sont donc le cœur de
NUTRI-DÉPIST : les enfants de 6 à 59 mois (mesure du périmètre brachial, PB), les
femmes enceintes/allaitantes (suivi de la hauteur utérine en CPN), et les personnes
âgées (score MNA-SF). Le dépistage papier actuel souffre de trois limites
structurelles que NUTRI-DÉPIST cible directement : (1) perte ou retard de données
faute de réseau au moment de la saisie, (2) absence de remontée automatique vers le
centre de santé pour les cas sévères, (3) risque d'erreur humaine dans l'application
des seuils cliniques.

`[À COMPLÉTER : chiffres plus récents si trouvés (2024-2026), et angle spécifique
apporté par Lionel sur la partie vision par ordinateur / pitch.]`

## 3. Solution proposée *(1,5 page)*

Principe directeur : **l'IA assiste, l'ASC valide, le protocole classe, le
professionnel de santé prend en charge.** Aucune estimation issue de la vision par
ordinateur n'entre dans la classification sans confirmation explicite de l'agent.

`[À COMPLÉTER par Alya (pipeline Mesure → Interprétation → Classification →
Orientation) et Lionel (flux de capture guidée) — décrire le parcours utilisateur
de bout en bout avec 1-2 captures d'écran en annexe.]`

## 4. Architecture technique *(2 pages)* — brouillon rédigé (Volet 1 + contrat)

NUTRI-DÉPIST est une application mobile React Native, avec un backend FastAPI /
PostgreSQL, conçue **local-first** : chaque écran écrit d'abord dans une base SQLite
embarquée sur l'appareil, puis synchronise vers le serveur dès que le réseau est
disponible — jamais l'inverse. Cette approche garantit qu'aucune saisie n'est perdue
même dans les zones sans couverture réseau, contrainte de terrain incontournable pour
des ASC en zone rurale.

**Stockage local et file de synchronisation** (module `mobile/sync/`) :
- Table locale `depistages_locaux` : historique complet consultable hors-ligne, avec
  statut de synchronisation par entrée.
- Classification provisoire calculée localement à partir des seuils critiques du
  protocole PCIMA (PB < 115 mm → sévère chez l'enfant, score MNA-SF ≤ 6 → dénutrition
  probable, écart de hauteur utérine hors tolérance ± 3 cm), remplacée par la
  classification officielle du serveur dès la synchronisation.
- Détection de doublon : deux saisies du même agent, même centre, même population, à
  moins de 15 minutes d'écart sont **toutes deux conservées** et marquées comme
  ambiguës — jamais d'écrasement automatique, la décision finale reste humaine.
- Table `SynchronisationLog(depistage_id, date_saisie_locale, date_synchronisation)`
  conforme au contrat d'interface, pour tracer le délai réel entre saisie terrain et
  remontée serveur — indicateur utile pour évaluer la couverture réseau réelle d'un
  district.

**Modèle de données et endpoints** : voir `docs/CONTRAT_INTERFACE.md`, source de
vérité unique du projet (tables `Depistage`, `MesureEnfant`, `SuiviGrossesse`,
`MesurePersonneAgee`, `CaptureVision`, `Seuils`, `SynchronisationLog`,
`JournalValidationSeuils` ; endpoint principal `POST /depistage`).

`[À COMPLÉTER par Alya : détail du pipeline de classification et de la table
Seuils versionnée ; par Lionel : détail du module vision.]`

## 5. Sécurité et gouvernance des données *(1 page)*

Chaque dépistage est rattaché à un `agent_id` et un `centre_id`. Un principe simple
mais non négociable pour la démo : **un agent d'un centre ne doit jamais pouvoir
consulter les données d'un autre centre.** Ce contrôle a été identifié comme absent
du backend actuel pendant le développement (voir
`backend/tests/test_security_centre_isolation.py`) et une correction minimale a été
proposée à l'équipe avant la démo.

`[À COMPLÉTER : statut de la correction au moment du dépôt final, et politique de
conservation/anonymisation des données si le projet est évalué sur ce critère.]`

## 6. Écosystème et modèle économique *(1 page)*

Voir en détail `docs/CARTOGRAPHIE_ECOSYSTEME.md` (acteurs : ASC, CSPS, Direction de la
Nutrition MSHP, DRS, ONG ALIMA/Croix-Rouge/Helen Keller, UNICEF, Groupe Nutriset,
CAMEG) et `docs/BUSINESS_MODEL_CANVAS.md` (modèle B2B/B2G par licence de district
sanitaire). Résumé en une phrase : le modèle s'adresse aux districts sanitaires et
aux ONG opérant des équipes d'ASC, pas directement aux agents de terrain, qui restent
salariés ou bénévoles d'une structure.

## 7. Limites, risques et travaux futurs *(1 page)*

- Classification hors-ligne volontairement simplifiée (seuils critiques dupliqués
  côté mobile) : à resynchroniser manuellement si le protocole national évolue.
- Vision par ordinateur = prototype, flux fonctionnel non validé cliniquement.
- Pas d'authentification forte dans la version hackathon (voir §5) — à traiter avant
  tout déploiement réel au-delà de la démo.
- `SynchronisationLog` n'existe pour l'instant que côté mobile ; un miroir serveur
  serait nécessaire pour un pilotage district à distance.

`[À COMPLÉTER collectivement en fin de hackathon, une fois qu'on sait ce qui a
réellement pu être livré pour la démo vs. ce qui reste roadmap.]`

## 8. Conclusion *(¼ page)*

`[À COMPLÉTER en dernier.]`

## Sources

Voir la liste consolidée dans `docs/CARTOGRAPHIE_ECOSYSTEME.md`. À ajouter ici au
moment de la mise en forme finale : toute source spécifique au moteur de
classification (Alya) et au module vision (Lionel).

## Annexes (hors limite de 10 pages)

- Contrat d'interface complet (`docs/CONTRAT_INTERFACE.md`)
- Captures d'écran de l'application
- Résultats des tests (Volet 2)
