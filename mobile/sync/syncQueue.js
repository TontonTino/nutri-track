/**
 * mobile/sync/syncQueue.js
 * Rasmata — File de synchronisation + historique local (VOLET 1).
 *
 * C'est LE point d'entrée que Fanta (écrans de saisie) et Lionel (écran de
 * confirmation vision) doivent appeler après validation d'un dépistage :
 *
 *   import { enregistrerDepistage } from '../sync';
 *   const resultat = await enregistrerDepistage({
 *     population: 'enfant',
 *     mesures: { pb: 112, oedemes_bilateraux: false },
 *     agent_id: currentAgent.id,
 *     centre_id: currentAgent.centre_id,
 *     mode_saisie: 'manuel', // ou 'vision' si ça vient du module de Lionel
 *   });
 *
 * enregistrerDepistage() ÉCRIT TOUJOURS EN LOCAL D'ABORD (local-first), qu'on soit
 * en ligne ou non, puis déclenche une tentative de sync en tâche de fond. L'écran
 * n'a jamais besoin d'attendre le réseau pour continuer.
 */

import { getDb } from './database';
import { classifierHorsLigne } from './localClassifier';
import { envoyerDepistage } from './api';

// Fenêtre de temps en dessous de laquelle deux saisies du même agent, même centre,
// même population sont considérées comme un possible doublon (même événement saisi
// deux fois) plutôt que deux dépistages distincts. À ajuster avec l'équipe si besoin.
const FENETRE_CONFLIT_MS = 15 * 60 * 1000; // 15 minutes

function genererUuid() {
  // UUID v4 "suffisant" pour un identifiant local d'appareil — pas besoin de
  // dépendance externe pour un hackathon de 2 jours.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Deux dépistages sont considérés comme le "même événement" possiblement saisi
 * en double si : même agent, même centre, même population, et horodatages
 * de saisie locale proches. On ne compare JAMAIS pour décider d'écraser —
 * uniquement pour signaler l'ambiguïté à l'agent/au superviseur.
 */
export function sontPossiblementLeMemeEvenement(a, b) {
  if (a.local_id === b.local_id) return false;
  if (a.agent_id !== b.agent_id) return false;
  if (a.centre_id !== b.centre_id) return false;
  if (a.population !== b.population) return false;

  const dateA = new Date(a.date_saisie_locale).getTime();
  const dateB = new Date(b.date_saisie_locale).getTime();
  return Math.abs(dateA - dateB) <= FENETRE_CONFLIT_MS;
}

/**
 * Enregistre un dépistage saisi (en ligne ou hors-ligne) : écriture locale
 * immédiate + détection de doublon ambigu + tentative de sync en arrière-plan.
 * Ne bloque jamais l'utilisateur sur le réseau.
 */
export async function enregistrerDepistage({ population, mesures, agent_id, centre_id, mode_saisie = 'manuel' }) {
  const db = await getDb();
  const local_id = genererUuid();
  const maintenant = new Date().toISOString();

  const { classification, orientation_declenchee } = classifierHorsLigne(population, mesures);

  await db.runAsync(
    `INSERT INTO depistages_locaux
      (local_id, population, mesures, agent_id, centre_id, mode_saisie,
       classification_locale, classification_locale_provisoire, orientation_declenchee,
       date_saisie_locale, statut_sync)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'en_attente')`,
    [local_id, population, JSON.stringify(mesures), agent_id, centre_id, mode_saisie,
      classification, orientation_declenchee ? 1 : 0, maintenant]
  );

  await db.runAsync(
    `INSERT INTO synchronisation_log (depistage_id, date_saisie_locale, date_synchronisation)
     VALUES (?, ?, NULL)`,
    [local_id, maintenant]
  );

  const conflit = await detecterEtSignalerConflits(local_id);

  // Tentative de sync silencieuse — ne pas attendre le résultat pour rendre la main
  // à l'écran. syncPendingDepistages() gère déjà ses propres erreurs réseau.
  syncPendingDepistages().catch(() => {});

  return { local_id, classification, orientation_declenchee, conflit_ambigu: conflit };
}

/**
 * Compare la nouvelle entrée à toutes les entrées en attente ou récentes du même
 * agent/centre/population et, en cas d'ambiguïté, marque LES DEUX entrées comme
 * conflit_ambigu = 1 SANS EN SUPPRIMER OU EN ÉCRASER AUCUNE.
 */
async function detecterEtSignalerConflits(nouveauLocalId) {
  const db = await getDb();
  const nouveau = await db.getFirstAsync(
    `SELECT * FROM depistages_locaux WHERE local_id = ?`, [nouveauLocalId]
  );
  if (!nouveau) return false;

  const candidats = await db.getAllAsync(
    `SELECT * FROM depistages_locaux
     WHERE agent_id = ? AND centre_id = ? AND population = ? AND local_id != ?`,
    [nouveau.agent_id, nouveau.centre_id, nouveau.population, nouveau.local_id]
  );

  const doublonPossible = candidats.find((c) => sontPossiblementLeMemeEvenement(nouveau, c));
  if (!doublonPossible) return false;

  await db.runAsync(
    `UPDATE depistages_locaux SET conflit_ambigu = 1, conflit_avec_local_id = ? WHERE local_id = ?`,
    [doublonPossible.local_id, nouveau.local_id]
  );
  await db.runAsync(
    `UPDATE depistages_locaux SET conflit_ambigu = 1, conflit_avec_local_id = ? WHERE local_id = ?`,
    [nouveau.local_id, doublonPossible.local_id]
  );

  return true;
}

/** Historique complet consultable hors-ligne (synchronisé ou non). */
export async function getHistorique({ centre_id } = {}) {
  const db = await getDb();
  if (centre_id) {
    return db.getAllAsync(
      `SELECT * FROM depistages_locaux WHERE centre_id = ? ORDER BY date_saisie_locale DESC`,
      [centre_id]
    );
  }
  return db.getAllAsync(`SELECT * FROM depistages_locaux ORDER BY date_saisie_locale DESC`);
}

/** Nombre de dépistages encore en attente de synchronisation (pour le badge discret). */
export async function getNombreEnAttente() {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) as n FROM depistages_locaux WHERE statut_sync = 'en_attente'`
  );
  return row?.n ?? 0;
}

/**
 * Tente de synchroniser toutes les entrées en attente, une par une, dans l'ordre
 * de saisie. Chaque entrée en conflit ambigu est envoyée séparément elle aussi :
 * on ne fusionne ni ne supprime jamais rien localement, le signalement de
 * l'ambiguïté reste visible pour un agent/superviseur même après sync.
 * Ne lève jamais d'exception globale : les échecs individuels sont capturés
 * pour que les entrées suivantes soient quand même tentées.
 */
export async function syncPendingDepistages() {
  const db = await getDb();
  const enAttente = await db.getAllAsync(
    `SELECT * FROM depistages_locaux WHERE statut_sync = 'en_attente' ORDER BY date_saisie_locale ASC`
  );

  const resultats = { succes: 0, echecs: 0 };

  for (const entree of enAttente) {
    try {
      const reponse = await envoyerDepistage(entree);
      const maintenant = new Date().toISOString();

      await db.runAsync(
        `UPDATE depistages_locaux
         SET server_id = ?, classification_serveur = ?, classification_locale_provisoire = 0,
             statut_sync = 'synchronise', derniere_erreur_sync = NULL
         WHERE local_id = ?`,
        [reponse.id, reponse.classification, entree.local_id]
      );
      await db.runAsync(
        `UPDATE synchronisation_log SET date_synchronisation = ?
         WHERE depistage_id = ? AND date_synchronisation IS NULL`,
        [maintenant, entree.local_id]
      );

      resultats.succes += 1;
    } catch (err) {
      await db.runAsync(
        `UPDATE depistages_locaux
         SET nb_tentatives_sync = nb_tentatives_sync + 1, derniere_erreur_sync = ?
         WHERE local_id = ?`,
        [String(err?.message ?? err), entree.local_id]
      );
      resultats.echecs += 1;
      // On continue avec les entrées suivantes — une panne réseau au milieu de la
      // file ne doit jamais bloquer les autres dépistages en attente.
    }
  }

  return resultats;
}
