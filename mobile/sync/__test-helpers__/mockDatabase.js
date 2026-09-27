/**
 * mockDatabase.js — double de test.
 *
 * Ce n'est PAS un moteur SQL générique : il reconnaît uniquement les requêtes
 * exactes utilisées dans database.js / syncQueue.js et les rejoue sur des
 * tableaux JS en mémoire. Suffisant pour tester la LOGIQUE (file d'attente,
 * détection de conflit, sync) sans dépendre d'expo-sqlite (module natif,
 * indisponible sans device/simulateur).
 *
 * Si les requêtes SQL changent dans syncQueue.js, ce fichier doit être mis à jour.
 */

function creerMockDb() {
  const tables = {
    depistages_locaux: [],
    synchronisation_log: [],
  };

  function trouverParLocalId(id) {
    return tables.depistages_locaux.find((r) => r.local_id === id);
  }

  return {
    _tables: tables, // exposé pour inspection directe dans les tests

    async execAsync() {
      // Création de schéma : rien à faire, les tables existent déjà en mémoire.
    },

    async runAsync(sql, params = []) {
      const s = sql.replace(/\s+/g, ' ').trim();

      if (s.startsWith('INSERT INTO depistages_locaux')) {
        const [local_id, population, mesures, agent_id, centre_id, mode_saisie,
          classification_locale, orientation_declenchee, date_saisie_locale] = params;
        tables.depistages_locaux.push({
          local_id, server_id: null, population, mesures, agent_id, centre_id, mode_saisie,
          classification_locale, classification_locale_provisoire: 1,
          classification_serveur: null,
          orientation_declenchee, date_saisie_locale, statut_sync: 'en_attente',
          conflit_ambigu: 0, conflit_avec_local_id: null,
          derniere_erreur_sync: null, nb_tentatives_sync: 0,
        });
        return;
      }

      if (s.startsWith('INSERT INTO synchronisation_log')) {
        const [depistage_id, date_saisie_locale] = params;
        tables.synchronisation_log.push({
          id: tables.synchronisation_log.length + 1,
          depistage_id, date_saisie_locale, date_synchronisation: null,
        });
        return;
      }

      if (s.includes('UPDATE depistages_locaux SET conflit_ambigu = 1')) {
        const [conflit_avec_local_id, local_id] = params;
        const row = trouverParLocalId(local_id);
        if (row) { row.conflit_ambigu = 1; row.conflit_avec_local_id = conflit_avec_local_id; }
        return;
      }

      if (s.includes("statut_sync = 'synchronise'")) {
        const [server_id, classification_serveur, local_id] = params;
        const row = trouverParLocalId(local_id);
        if (row) {
          row.server_id = server_id;
          row.classification_serveur = classification_serveur;
          row.classification_locale_provisoire = 0;
          row.statut_sync = 'synchronise';
          row.derniere_erreur_sync = null;
        }
        return;
      }

      if (s.startsWith('UPDATE synchronisation_log')) {
        const [date_synchronisation, depistage_id] = params;
        const row = tables.synchronisation_log.find(
          (r) => r.depistage_id === depistage_id && r.date_synchronisation === null
        );
        if (row) row.date_synchronisation = date_synchronisation;
        return;
      }

      if (s.includes('nb_tentatives_sync = nb_tentatives_sync + 1')) {
        const [erreur, local_id] = params;
        const row = trouverParLocalId(local_id);
        if (row) { row.nb_tentatives_sync += 1; row.derniere_erreur_sync = erreur; }
        return;
      }

      throw new Error(`mockDatabase: requête runAsync non supportée: ${s}`);
    },

    async getFirstAsync(sql, params = []) {
      const s = sql.replace(/\s+/g, ' ').trim();

      if (s.includes('WHERE local_id = ?')) {
        return trouverParLocalId(params[0]) ?? null;
      }
      if (s.includes('COUNT(*) as n')) {
        return { n: tables.depistages_locaux.filter((r) => r.statut_sync === 'en_attente').length };
      }
      throw new Error(`mockDatabase: requête getFirstAsync non supportée: ${s}`);
    },

    async getAllAsync(sql, params = []) {
      const s = sql.replace(/\s+/g, ' ').trim();

      if (s.includes('agent_id = ? AND centre_id = ? AND population = ? AND local_id != ?')) {
        const [agent_id, centre_id, population, local_id] = params;
        return tables.depistages_locaux.filter((r) =>
          r.agent_id === agent_id && r.centre_id === centre_id &&
          r.population === population && r.local_id !== local_id
        );
      }
      if (s.includes("WHERE statut_sync = 'en_attente'")) {
        return [...tables.depistages_locaux]
          .filter((r) => r.statut_sync === 'en_attente')
          .sort((a, b) => new Date(a.date_saisie_locale) - new Date(b.date_saisie_locale));
      }
      if (s.includes('WHERE centre_id = ? ORDER BY')) {
        return [...tables.depistages_locaux]
          .filter((r) => r.centre_id === params[0])
          .sort((a, b) => new Date(b.date_saisie_locale) - new Date(a.date_saisie_locale));
      }
      if (s.startsWith('SELECT * FROM depistages_locaux ORDER BY')) {
        return [...tables.depistages_locaux]
          .sort((a, b) => new Date(b.date_saisie_locale) - new Date(a.date_saisie_locale));
      }
      throw new Error(`mockDatabase: requête getAllAsync non supportée: ${s}`);
    },
  };
}

module.exports = { creerMockDb };
