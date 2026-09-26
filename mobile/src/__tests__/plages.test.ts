import { describe, expect, it } from 'vitest';
import { champDepuisMessage } from '../services/api';
import { ApiError } from '../services/apiError';
import { verifierPlages } from '../services/plages';

function erreurDe(fn: () => void): ApiError {
  try {
    fn();
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('aucune erreur levée');
}

describe('verifierPlages', () => {
  it('accepte le cas de référence (PB 112 mm)', () => {
    expect(() => verifierPlages('enfant', { pb: 112, poids: 9.5, taille: 78 })).not.toThrow();
  });
  it("rejette PB 900 en désignant le champ, au format de message de l'API", () => {
    const e = erreurDe(() => verifierPlages('enfant', { pb: 900, poids: 9.5, taille: 78 }));
    expect(e).toBeInstanceOf(ApiError);
    expect(e.kind).toBe('hors_plage');
    expect(e.champ).toBe('pb');
    expect(e.message).toContain('[50, 350]');
    expect(champDepuisMessage(e.message)).toBe('pb');
  });
  it('les bornes sont incluses', () => {
    expect(() => verifierPlages('enfant', { pb: 50 })).not.toThrow();
    expect(() => verifierPlages('enfant', { pb: 350 })).not.toThrow();
    expect(() => verifierPlages('enfant', { pb: 49.9 })).toThrow();
  });
  it('couvre grossesse et personne âgée', () => {
    expect(erreurDe(() => verifierPlages('enceinte', { hauteur_uterine: 60, semaine_amenorrhee: 28, pb: 210 })).champ).toBe('hauteur_uterine');
    expect(erreurDe(() => verifierPlages('personne_agee', { score_mna_sf: 15 })).champ).toBe('score_mna_sf');
  });
  it('ignore les champs facultatifs absents ou non numériques', () => {
    expect(() => verifierPlages('personne_agee', { score_mna_sf: 6 })).not.toThrow();
    expect(() => verifierPlages('enceinte', { personne_id: 'P-1', hauteur_uterine: 22, semaine_amenorrhee: 28 })).not.toThrow();
  });
});
