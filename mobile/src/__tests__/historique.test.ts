import { describe, expect, it, vi } from 'vitest';
import { dateCpn, type EnregistrementHistorique, genererIdLocal, suiviGrossesseDe } from '../data/historique';

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
    orientation_declenchee: false,
    message: null,
    recommandation: null,
    oedemes_incertains: false,
    synchronise: true,
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
  it('combine agent, centre et horodatage, et reste unique', () => {
    const t = new Date('2026-09-26T10:00:00Z');
    const a = genererIdLocal('agent-1', 'centre-1', t);
    const b = genererIdLocal('agent-1', 'centre-1', t);
    expect(a.startsWith(`agent-1.centre-1.${t.getTime()}.`)).toBe(true);
    expect(a).not.toBe(b);
  });
});
