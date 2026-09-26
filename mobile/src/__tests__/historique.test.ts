import { describe, expect, it, vi } from 'vitest';
import { dateCpn, type EnregistrementHistorique, genererIdLocal, type LigneLocale, memeEvenement, suiviGrossesseDe, versEnregistrement } from '../data/historique';

// react-native n'est pas exécutable sous Node : seul Platform.OS est utilisé par le module testé (vi.mock est hissé).
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

function suivi(ref: string, dateDeCpn: string, hu: number, sa: number, saisie: string): EnregistrementHistorique {
  return {
    id: `${ref}-${dateDeCpn}`,
    serveur_id: 1,
    population: 'enceinte',
    personne_ref: ref,
    date_saisie: saisie,
    agent_id: 'a',
    centre_id: 'c',
    mesures: { date_cpn: dateDeCpn, hauteur_uterine: hu, semaine_amenorrhee: sa },
    classification: 'normal',
    provisoire: false,
    orientation_declenchee: false,
    message: null,
    recommandation: null,
    oedemes_incertains: false,
    synchronise: true,
    conflit_ambigu: false,
  };
}

describe('suiviGrossesseDe', () => {
  it('ne garde que la patiente demandée, triée par date de CPN croissante', () => {
    const tous = [
      suivi('P-1', '2026-09-20', 26, 26, '2026-09-26T10:00:00Z'),
      suivi('P-2', '2026-09-01', 20, 20, '2026-09-26T10:01:00Z'),
      suivi('P-1', '2026-08-23', 22, 22, '2026-09-26T10:02:00Z'),
    ];
    const r = suiviGrossesseDe(tous, 'P-1');
    expect(r.map((x) => dateCpn(x))).toEqual(['2026-08-23', '2026-09-20']);
  });
  it("ignore les dépistages d'autres populations", () => {
    const enfant = { ...suivi('P-1', '2026-09-20', 0, 0, '2026-09-26T10:00:00Z'), population: 'enfant' as const };
    expect(suiviGrossesseDe([enfant], 'P-1')).toEqual([]);
  });
});

describe('genererIdLocal', () => {
  it('produit des identifiants uniques au format UUID v4', () => {
    const a = genererIdLocal();
    const b = genererIdLocal();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});

function ligne(surcharge: Partial<LigneLocale> = {}): LigneLocale {
  return {
    local_id: 'L1',
    server_id: null,
    population: 'enfant',
    mesures: JSON.stringify({ pb: 112 }),
    agent_id: 'agent-demo',
    centre_id: 'centre-demo',
    classification_locale: 'sévère',
    classification_locale_provisoire: 1,
    classification_serveur: null,
    orientation_declenchee: 1,
    date_saisie_locale: '2026-09-26T10:00:00.000Z',
    statut_sync: 'en_attente',
    conflit_ambigu: 0,
    ...surcharge,
  };
}

describe('versEnregistrement', () => {
  it('une entrée hors ligne est provisoire et non synchronisée', () => {
    const e = versEnregistrement(ligne());
    expect(e.classification).toBe('sévère');
    expect(e.provisoire).toBe(true);
    expect(e.synchronise).toBe(false);
    expect(e.orientation_declenchee).toBe(true);
    expect(e.mesures).toEqual({ pb: 112 });
  });
  it("dès que le serveur a confirmé, sa classification prime et le résultat n'est plus provisoire", () => {
    const e = versEnregistrement(
      ligne({ classification_locale: 'modéré', classification_serveur: 'sévère', classification_locale_provisoire: 0, statut_sync: 'synchronise', server_id: 7 }),
    );
    expect(e.classification).toBe('sévère');
    expect(e.provisoire).toBe(false);
    expect(e.synchronise).toBe(true);
    expect(e.serveur_id).toBe(7);
  });
  it('reprend les informations annexes (code, œdèmes incertains, message, recommandation)', () => {
    const e = versEnregistrement(ligne(), { personne_ref: 'E-12', oedemes_incertains: true, message: 'm', recommandation: 'r' });
    expect(e.personne_ref).toBe('E-12');
    expect(e.oedemes_incertains).toBe(true);
    expect(e.message).toBe('m');
    expect(e.recommandation).toBe('r');
  });
  it("pour la grossesse, retrouve la patiente dans les mesures si l'annexe est absente", () => {
    const e = versEnregistrement(ligne({ population: 'enceinte', mesures: JSON.stringify({ personne_id: 'P-001' }) }));
    expect(e.personne_ref).toBe('P-001');
  });
  it('signale un doublon possible et tolère une classification absente', () => {
    const e = versEnregistrement(ligne({ conflit_ambigu: 1, classification_locale: null }));
    expect(e.conflit_ambigu).toBe(true);
    expect(e.classification).toBe('inconnu');
  });
});

describe('memeEvenement : distinguer une vraie double saisie de deux personnes qui se suivent', () => {
  it('deux enfants consécutifs aux mesures différentes ne sont pas un doublon', () => {
    expect(memeEvenement(ligne({ mesures: JSON.stringify({ pb: 112, poids: 9.5 }) }), ligne({ local_id: 'L2', mesures: JSON.stringify({ pb: 130, poids: 9.5 }) }))).toBe(false);
  });
  it("des mesures identiques signalent un doublon possible, quel que soit l'ordre des champs", () => {
    const a = ligne({ mesures: JSON.stringify({ pb: 112, poids: 9.5 }) });
    const b = ligne({ local_id: 'L2', mesures: JSON.stringify({ poids: 9.5, pb: 112 }) });
    expect(memeEvenement(a, b)).toBe(true);
  });
  it('deux codes de personne différents écartent le doublon, même à mesures identiques', () => {
    const a = ligne();
    const b = ligne({ local_id: 'L2' });
    const x = (ref: string) => ({ personne_ref: ref, oedemes_incertains: false, message: null, recommandation: null });
    expect(memeEvenement(a, b, x('E-1'), x('E-2'))).toBe(false);
    expect(memeEvenement(a, b, x('E-1'), x('E-1'))).toBe(true);
  });
  it('des populations différentes ne sont jamais un doublon', () => {
    expect(memeEvenement(ligne(), ligne({ local_id: 'L2', population: 'enceinte' }))).toBe(false);
  });
  it("versEnregistrement n'affiche l'alerte que si le doublon est confirmé", () => {
    expect(versEnregistrement(ligne({ conflit_ambigu: 1 }), undefined, false).conflit_ambigu).toBe(false);
    expect(versEnregistrement(ligne({ conflit_ambigu: 1 }), undefined, true).conflit_ambigu).toBe(true);
  });
});
