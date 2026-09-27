/**
 * mobile/sync/database.js
 * Rasmata — Stockage local (SQLite via expo-sqlite)
 *
 * Deux tables :
 *  - depistages_locaux : copie locale de CHAQUE dépistage saisi sur l'appareil,
 *    qu'il soit déjà synchronisé ou en attente. C'est ce qui permet l'historique
 *    et la classification hors-ligne (VOLET 1).
 *  - synchronisation_log : trace du contrat CONTRAT_INTERFACE.md
 *    SynchronisationLog(depistage_id, date_saisie_locale, date_synchronisation)
 *
 * Choix technique : expo-sqlite plutôt que WatermelonDB.
 * WatermelonDB apporte de la réactivité et un vrai moteur de sync, mais demande
 * du code natif / autolinking à configurer — trop risqué en 2 jours si Fanta
 * n'a pas encore un projet Expo stabilisé. expo-sqlite fait le job (file d'attente
 * + historique + requêtes SQL simples) avec zéro configuration native.
 * Si le temps le permet après la démo, la migration vers WatermelonDB est possible
 * car toute la logique métier est isolée dans syncQueue.js, pas dans les écrans.
 */

import * as SQLite from 'expo-sqlite';

let dbPromise = null;
let initPromise = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('nutri_depist.db');
  }
  if (!initPromise) {
    initPromise = dbPromise.then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS depistages_locaux (
          local_id TEXT PRIMARY KEY NOT NULL,
          server_id INTEGER,
          population TEXT NOT NULL,
          mesures TEXT NOT NULL,
          agent_id TEXT NOT NULL,
          centre_id TEXT NOT NULL,
          mode_saisie TEXT NOT NULL DEFAULT 'manuel',
          classification_locale TEXT,
          classification_locale_provisoire INTEGER NOT NULL DEFAULT 1,
          classification_serveur TEXT,
          orientation_declenchee INTEGER NOT NULL DEFAULT 0,
          date_saisie_locale TEXT NOT NULL,
          statut_sync TEXT NOT NULL DEFAULT 'en_attente',
          conflit_ambigu INTEGER NOT NULL DEFAULT 0,
          conflit_avec_local_id TEXT,
          derniere_erreur_sync TEXT,
          nb_tentatives_sync INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_depistages_statut ON depistages_locaux(statut_sync);
        CREATE INDEX IF NOT EXISTS idx_depistages_centre ON depistages_locaux(centre_id);

        CREATE TABLE IF NOT EXISTS synchronisation_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          depistage_id TEXT NOT NULL,
          date_saisie_locale TEXT NOT NULL,
          date_synchronisation TEXT
        );
      `);
      return db;
    }).catch((err) => {
      dbPromise = null;
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export async function initDatabase() {
  return getDb();
}
