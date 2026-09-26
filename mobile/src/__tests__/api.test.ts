import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function chargerApi(useMock: boolean) {
  vi.resetModules();
  vi.stubEnv('EXPO_PUBLIC_USE_MOCK', String(useMock));
  return import('../services/api');
}

const enfant = (pb: number, oedemes = false) => ({
  pb,
  pb_source: 'manuel',
  poids: 9.5,
  taille: 78,
  oedemes_bilateraux: oedemes,
  oedemes_source: 'clinique',
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('postDepistage avec le mock', () => {
  it('PB 112 mm -> sévère avec orientation', async () => {
    const { postDepistage, construireRequete } = await chargerApi(true);
    const r = await postDepistage(construireRequete('enfant', enfant(112)));
    expect(r.classification).toBe('sévère');
    expect(r.orientation_declenchee).toBe(true);
  });
  it('un seul indicateur sévère suffit : PB normal mais œdèmes -> sévère', async () => {
    const { postDepistage, construireRequete } = await chargerApi(true);
    const r = await postDepistage(construireRequete('enfant', enfant(140, true)));
    expect(r.classification).toBe('sévère');
  });
  it('PB 130, sans œdèmes -> normal', async () => {
    const { postDepistage, construireRequete } = await chargerApi(true);
    const r = await postDepistage(construireRequete('enfant', enfant(130)));
    expect(r.classification).toBe('normal');
    expect(r.orientation_declenchee).toBe(false);
  });
  it('rejette PB 900 avant tout appel', async () => {
    const { postDepistage, construireRequete } = await chargerApi(true);
    await expect(postDepistage(construireRequete('enfant', enfant(900)))).rejects.toMatchObject({ kind: 'hors_plage', champ: 'pb' });
  });
  it('grossesse : écart hors tolérance -> ecart_suivi_rapproche', async () => {
    const { postDepistage, construireRequete } = await chargerApi(true);
    const r = await postDepistage(
      construireRequete('enceinte', { personne_id: 'P-1', hauteur_uterine: 22, hauteur_uterine_source: 'mètre_ruban', pb: 260, semaine_amenorrhee: 28 }),
    );
    expect(r.classification).toBe('ecart_suivi_rapproche');
    expect(r.message).toBe('Écart observé par rapport à la référence — suivi rapproché recommandé');
  });
  it('personne âgée : MNA-SF 6 -> dénutrition probable', async () => {
    const { postDepistage, construireRequete } = await chargerApi(true);
    const r = await postDepistage(construireRequete('personne_agee', { score_mna_sf: 6, perimetre_mollet: 31 }));
    expect(r.classification).toBe('dénutrition probable');
  });
});

describe("postDepistage contre l'API réelle (fetch simulé)", () => {
  beforeEach(() => vi.stubEnv('EXPO_PUBLIC_API_URL', 'http://api.test'));

  it("envoie le corps attendu par l'API", async () => {
    const fetchSimule = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 1, classification: 'sévère', orientation_declenchee: true }),
    });
    vi.stubGlobal('fetch', fetchSimule);
    const { postDepistage, construireRequete } = await chargerApi(false);
    await postDepistage(construireRequete('enfant', enfant(112)));
    const [url, init] = fetchSimule.mock.calls[0];
    expect(url).toBe('http://api.test/depistage');
    const corps = JSON.parse(init.body);
    expect(corps.population).toBe('enfant');
    expect(corps.mode_saisie).toBe('manuel');
    expect(corps.mesures.oedemes_bilateraux).toBe(false);
    expect(corps).not.toHaveProperty('date');
  });
  it("interprète le 422 « hors plage » d'Alya et retrouve le champ", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ detail: "Erreur de mesure: La mesure 'poids' (200) est hors de la plage physiologique valide [1.5, 35.0]. Nouvelle mesure demandée." }),
      }),
    );
    const { postDepistage, construireRequete } = await chargerApi(false);
    const e = await postDepistage(construireRequete('enfant', enfant(112))).catch((x) => x);
    expect(e.name).toBe('ApiError'); // pas instanceof : resetModules recharge la classe
    expect(e.kind).toBe('hors_plage');
    expect(e.champ).toBe('poids');
    expect(e.message.startsWith('Erreur de mesure')).toBe(false);
  });
  it('réseau coupé -> erreur claire, données conservées', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network request failed')));
    const { postDepistage, construireRequete } = await chargerApi(false);
    await expect(postDepistage(construireRequete('enfant', enfant(112)))).rejects.toMatchObject({ kind: 'reseau' });
  });
  it('réponse 500 -> erreur réseau, sans planter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('pas du json');
        },
      }),
    );
    const { postDepistage, construireRequete } = await chargerApi(false);
    await expect(postDepistage(construireRequete('enfant', enfant(112)))).rejects.toMatchObject({ kind: 'reseau' });
  });
});
