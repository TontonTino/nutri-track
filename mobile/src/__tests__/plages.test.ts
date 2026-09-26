import { describe, expect, it } from 'vitest';
import { nettoyer } from '../services/api';
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
    expect(e.message).toBe('Périmètre brachial : 900 mm est en dehors des valeurs possibles (50 à 350 mm). Vérifiez la mesure.');
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

describe("messages lisibles pour un poids de 50 kg (cas d'une capture d'écran)", () => {
  it("le message de l'app est en clair, avec la virgule décimale française", () => {
    const e = erreurDe(() => verifierPlages('enfant', { pb: 112, poids: 50, taille: 100 }));
    expect(e.champ).toBe('poids');
    expect(e.message).toBe('Poids : 50 kg est en dehors des valeurs possibles (1,5 à 35 kg). Vérifiez la mesure.');
  });
  it('le message brut du serveur est reformulé de la même façon', () => {
    const brut = "Erreur de mesure: La mesure 'poids' (50) est hors de la plage physiologique valide [1.5, 35.0]. Nouvelle mesure demandée.";
    expect(nettoyer(brut)).toBe('Poids : 50 kg est en dehors des valeurs possibles (1,5 à 35 kg). Vérifiez la mesure.');
  });
  it("un message inattendu du serveur est affiché tel quel, sans son préfixe technique", () => {
    expect(nettoyer('Erreur de mesure: quelque chose de nouveau')).toBe('quelque chose de nouveau');
  });
  it('une mesure inconnue reste compréhensible', () => {
    expect(nettoyer("La mesure 'inconnue' (7) est hors de la plage [1, 5]")).toContain('en dehors des valeurs possibles (1 à 5)');
  });
});
