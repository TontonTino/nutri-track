/**
 * VOLET 2 — Tests du module sync (Rasmata).
 * Couvre les 2 exigences qui concernent ce module :
 *  - parcours hors-ligne complet (saisie + classification + historique, sans réseau)
 *  - synchronisation sans perte ni duplication + conflits jamais écrasés
 * (Le 3e critère, "un agent ne voit pas les données d'un autre centre", est côté
 * backend : voir backend/tests/test_security_centre_isolation.py)
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import mockDatabase from '../__test-helpers__/mockDatabase.js';

const { creerMockDb } = mockDatabase;
const { mockDb } = vi.hoisted(() => ({ mockDb: { current: null } }));

vi.mock('../database', () => ({
  getDb: vi.fn(() => Promise.resolve(mockDb.current)),
  initDatabase: vi.fn(() => Promise.resolve(mockDb.current)),
}));

vi.mock('../api', () => ({
  envoyerDepistage: vi.fn(),
}));

import { envoyerDepistage } from '../api';
import {
  enregistrerDepistage,
  getHistorique,
  getNombreEnAttente,
  syncPendingDepistages,
  sontPossiblementLeMemeEvenement,
} from '../syncQueue';

beforeEach(() => {
  mockDb.current = creerMockDb();
  vi.mocked(envoyerDepistage).mockReset();
});

describe('Parcours hors-ligne complet', () => {
  test('un dépistage saisi sans réseau est stocké localement, classifié et consultable', async () => {
    vi.mocked(envoyerDepistage).mockRejectedValue(new Error('Network request failed'));

    const resultat = await enregistrerDepistage({
      population: 'enfant',
      mesures: { pb: 110, oedemes_bilateraux: false },
      agent_id: 'AGENT_01',
      centre_id: 'CENTRE_A',
      mode_saisie: 'manuel',
    });

    // Classification provisoire disponible immédiatement, sans réseau.
    expect(resultat.classification).toBe('sévère');
    expect(resultat.orientation_declenchee).toBe(true);

    // Consultable dans l'historique local hors-ligne.
    const historique = await getHistorique({ centre_id: 'CENTRE_A' });
    expect(historique).toHaveLength(1);
    expect(historique[0].statut_sync).toBe('en_attente');
    expect(historique[0].classification_locale_provisoire).toBe(1);

    // Badge "en attente" doit refléter la file.
    expect(await getNombreEnAttente()).toBe(1);
  });
});

describe('Synchronisation au retour réseau', () => {
  test('une saisie hors-ligne se synchronise sans perte ni duplication au retour réseau', async () => {
    vi.mocked(envoyerDepistage).mockRejectedValueOnce(new Error('Network request failed'));

    await enregistrerDepistage({
      population: 'personne_agee',
      mesures: { score_mna_sf: 6 },
      agent_id: 'AGENT_02',
      centre_id: 'CENTRE_B',
      mode_saisie: 'manuel',
    });

    expect(await getNombreEnAttente()).toBe(1);

    // Le réseau revient : le serveur répond correctement cette fois.
    vi.mocked(envoyerDepistage).mockResolvedValue({
      id: 4242,
      classification: 'dénutrition probable',
      orientation_declenchee: true,
    });

    const resultatSync = await syncPendingDepistages();
    expect(resultatSync.succes).toBe(1);
    expect(resultatSync.echecs).toBe(0);

    // Aucune perte, aucune duplication : toujours une seule ligne, maintenant synchronisée.
    const historique = await getHistorique({ centre_id: 'CENTRE_B' });
    expect(historique).toHaveLength(1);
    expect(historique[0].statut_sync).toBe('synchronise');
    expect(historique[0].server_id).toBe(4242);
    expect(historique[0].classification_serveur).toBe('dénutrition probable');
    expect(await getNombreEnAttente()).toBe(0);

    // SynchronisationLog rempli : date_synchronisation renseignée.
    expect(mockDb.current._tables.synchronisation_log).toHaveLength(1);
    expect(mockDb.current._tables.synchronisation_log[0].date_synchronisation).not.toBeNull();
  });

  test("une entrée qui échoue encore n'empêche pas la synchronisation des suivantes", async () => {
    vi.mocked(envoyerDepistage).mockRejectedValue(new Error('offline'));
    await enregistrerDepistage({
      population: 'enfant', mesures: { pb: 130 }, agent_id: 'A1', centre_id: 'C1',
    });
    await enregistrerDepistage({
      population: 'enfant', mesures: { pb: 130 }, agent_id: 'A2', centre_id: 'C1',
    });

    vi.mocked(envoyerDepistage)
      .mockRejectedValueOnce(new Error('toujours hors-ligne pour celle-ci'))
      .mockResolvedValueOnce({ id: 1, classification: 'normal', orientation_declenchee: false });

    const resultat = await syncPendingDepistages();
    expect(resultat.succes).toBe(1);
    expect(resultat.echecs).toBe(1);
    expect(await getNombreEnAttente()).toBe(1);
  });
});

describe('Gestion de conflit — deux saisies du même événement', () => {
  test('deux saisies proches du même agent/centre/population sont conservées toutes les deux et signalées', async () => {
    vi.mocked(envoyerDepistage).mockRejectedValue(new Error('offline'));

    await enregistrerDepistage({
      population: 'enfant', mesures: { pb: 112 }, agent_id: 'AGENT_09', centre_id: 'CENTRE_X',
    });
    const deuxieme = await enregistrerDepistage({
      population: 'enfant', mesures: { pb: 112 }, agent_id: 'AGENT_09', centre_id: 'CENTRE_X',
    });

    // Signalé sur la saisie qui déclenche la détection...
    expect(deuxieme.conflit_ambigu).toBe(true);

    // ...et les DEUX entrées existent toujours, aucune n'a écrasé l'autre.
    const historique = await getHistorique({ centre_id: 'CENTRE_X' });
    expect(historique).toHaveLength(2);
    expect(historique.every((h) => h.conflit_ambigu === 1)).toBe(true);
    expect(historique[0].local_id).not.toBe(historique[1].local_id);

    // Les deux se synchronisent quand même, comme deux dépistages distincts.
    vi.mocked(envoyerDepistage).mockResolvedValue({ id: 1, classification: 'sévère', orientation_declenchee: true });
    const resultatSync = await syncPendingDepistages();
    expect(resultatSync.succes).toBe(2);
  });

  test('des saisies éloignées dans le temps ne sont pas considérées en conflit', () => {
    const a = { local_id: '1', agent_id: 'X', centre_id: 'C', population: 'enfant', date_saisie_locale: '2026-09-26T08:00:00.000Z' };
    const b = { local_id: '2', agent_id: 'X', centre_id: 'C', population: 'enfant', date_saisie_locale: '2026-09-26T09:00:00.000Z' };
    expect(sontPossiblementLeMemeEvenement(a, b)).toBe(false);
  });

  test('un centre ou un agent différent ne déclenche jamais de conflit', () => {
    const a = { local_id: '1', agent_id: 'X', centre_id: 'C1', population: 'enfant', date_saisie_locale: '2026-09-26T08:00:00.000Z' };
    const b = { local_id: '2', agent_id: 'X', centre_id: 'C2', population: 'enfant', date_saisie_locale: '2026-09-26T08:01:00.000Z' };
    expect(sontPossiblementLeMemeEvenement(a, b)).toBe(false);
  });
});
