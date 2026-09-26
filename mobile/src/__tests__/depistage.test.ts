import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as historique from '../data/historique';
import * as api from '../services/api';
import { ApiError } from '../services/apiError';
import { effectuerDepistage, paramsResultat } from '../services/depistage';

// vi.mock est hissé au-dessus des imports par Vitest : les modules ci-dessus reçoivent bien les doublures.

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('../data/historique', () => ({
  ajouterDepistageSynchronise: vi.fn(async () => 'local-1'),
  enregistrerHorsLigne: vi.fn(async () => ({
    local_id: 'local-2',
    classification: 'sévère',
    orientation_declenchee: true,
    conflit_ambigu: false,
  })),
}));
vi.mock('../services/api', () => ({
  construireRequete: (population: string, mesures: object) => ({
    population,
    mesures,
    agent_id: 'agent-demo',
    centre_id: 'centre-demo',
    mode_saisie: 'manuel',
  }),
  postDepistage: vi.fn(),
}));

const mesureEnfant = {
  pb: 112,
  pb_source: 'manuel',
  poids: 9.5,
  taille: 78,
  oedemes_bilateraux: false,
  oedemes_source: 'clinique',
};
const reponseServeur = {
  id: 42,
  population: 'enfant',
  mesures: {},
  date: '2026-09-26T10:00:00',
  agent_id: 'agent-demo',
  centre_id: 'centre-demo',
  classification: 'sévère',
  orientation_declenchee: true,
  mode_saisie: 'manuel',
  message: null,
  recommandation: 'Transfert immédiat',
};

beforeEach(() => vi.clearAllMocks());

describe('effectuerDepistage : en ligne', () => {
  it('renvoie le résultat officiel du serveur et enregistre le dépistage comme synchronisé', async () => {
    vi.mocked(api.postDepistage).mockResolvedValue(reponseServeur);
    const r = await effectuerDepistage('enfant', mesureEnfant, { personneRef: ' E-7 ', oedemesIncertains: true });

    expect(r.provisoire).toBe(false);
    expect(r.classification).toBe('sévère');
    expect(r.recommandation).toBe('Transfert immédiat');
    expect(historique.enregistrerHorsLigne).not.toHaveBeenCalled();

    const enregistre = vi.mocked(historique.ajouterDepistageSynchronise).mock.calls[0][0];
    expect(enregistre.serveur_id).toBe(42);
    expect(enregistre.extras).toMatchObject({ personne_ref: 'E-7', oedemes_incertains: true, recommandation: 'Transfert immédiat' });
  });

  it("un échec de l'historique ne masque jamais le résultat", async () => {
    vi.mocked(api.postDepistage).mockResolvedValue(reponseServeur);
    vi.mocked(historique.ajouterDepistageSynchronise).mockRejectedValueOnce(new Error('disque plein'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await effectuerDepistage('enfant', mesureEnfant);
    expect(r.classification).toBe('sévère');
    expect(r.historiqueEnregistre).toBe(false);
  });
});

describe('effectuerDepistage : hors ligne', () => {
  it('enregistre en local avec une classification provisoire, sans jamais bloquer', async () => {
    vi.mocked(api.postDepistage).mockRejectedValue(new ApiError('hors_ligne', 'Serveur injoignable.'));
    const r = await effectuerDepistage('enfant', mesureEnfant);

    expect(r.provisoire).toBe(true);
    expect(r.classification).toBe('sévère');
    expect(r.recommandation).toBeNull();
    expect(historique.enregistrerHorsLigne).toHaveBeenCalledTimes(1);
    expect(historique.ajouterDepistageSynchronise).not.toHaveBeenCalled();
  });

  it('signale un possible doublon détecté par le module de synchronisation', async () => {
    vi.mocked(api.postDepistage).mockRejectedValue(new ApiError('hors_ligne', 'Serveur injoignable.'));
    vi.mocked(historique.enregistrerHorsLigne).mockResolvedValueOnce({
      local_id: 'local-3',
      classification: 'normal',
      orientation_declenchee: false,
      conflit_ambigu: true,
    });
    const r = await effectuerDepistage('enfant', mesureEnfant);
    expect(r.conflitAmbigu).toBe(true);
  });

  it("si l'enregistrement local échoue aussi, l'erreur remonte (la donnée ne doit jamais se perdre en silence)", async () => {
    vi.mocked(api.postDepistage).mockRejectedValue(new ApiError('hors_ligne', 'Serveur injoignable.'));
    vi.mocked(historique.enregistrerHorsLigne).mockRejectedValueOnce(new Error('base illisible'));
    await expect(effectuerDepistage('enfant', mesureEnfant)).rejects.toThrow('base illisible');
  });
});

describe("effectuerDepistage : erreurs du serveur (jamais mises en file d'attente)", () => {
  it('une valeur hors plage est renvoyée à l\'écran et rien n\'est enregistré', async () => {
    vi.mocked(api.postDepistage).mockRejectedValue(new ApiError('hors_plage', 'trop grand', 'pb'));
    await expect(effectuerDepistage('enfant', mesureEnfant)).rejects.toMatchObject({ kind: 'hors_plage', champ: 'pb' });
    expect(historique.enregistrerHorsLigne).not.toHaveBeenCalled();
    expect(historique.ajouterDepistageSynchronise).not.toHaveBeenCalled();
  });

  it('une erreur HTTP inattendue est renvoyée sans être mise en file', async () => {
    vi.mocked(api.postDepistage).mockRejectedValue(new ApiError('reseau', 'Réponse inattendue (500).'));
    await expect(effectuerDepistage('enfant', mesureEnfant)).rejects.toMatchObject({ kind: 'reseau' });
    expect(historique.enregistrerHorsLigne).not.toHaveBeenCalled();
  });
});

describe('paramsResultat', () => {
  it("transmet l'état provisoire, le doublon et les avertissements à l'écran de résultat", () => {
    const p = paramsResultat(
      'enfant',
      { classification: 'sévère', orientation_declenchee: true, message: null, recommandation: null, provisoire: true, conflitAmbigu: true, historiqueEnregistre: true },
      { oedemesIncertains: true },
    );
    expect(p).toMatchObject({ population: 'enfant', provisoire: '1', doublon: '1', oedemes_incertains: '1', historique_ok: '1', recommandation: '' });
  });
});
