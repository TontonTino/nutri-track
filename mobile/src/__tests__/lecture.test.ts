import { beforeEach, describe, expect, it } from 'vitest';
import { champsBrassard, consommerLecture, definirLecture, lectureActive, reinitialiserLecture } from '../brassard/lecture';

const lecture = { valeur_mm: 112, controle: 'coherent' as const, couleur_detectee: 'rouge' as const };

describe('lecture du brassard validée par l\'agent', () => {
  beforeEach(() => reinitialiserLecture());

  it("n'est lue qu'une fois, pour ne pas être réappliquée à chaque retour sur le formulaire", () => {
    definirLecture(lecture);
    expect(consommerLecture()).toEqual(lecture);
    expect(consommerLecture()).toBeNull();
  });

  it('le contrôle photo ne vaut que pour la valeur photographiée', () => {
    expect(lectureActive('112', lecture)).toBe(lecture);
    expect(lectureActive('112,0', lecture)).toBe(lecture);
    expect(lectureActive('113', lecture)).toBeNull();
    expect(lectureActive('', lecture)).toBeNull();
    expect(lectureActive('112', null)).toBeNull();
  });

  it('envoie la traçabilité du contrôle sans jamais transformer la valeur lue en estimation de l\'IA', () => {
    expect(champsBrassard(lecture)).toEqual({ pb_controle_photo: 'coherent', pb_couleur_detectee: 'rouge' });
    expect(champsBrassard({ valeur_mm: 130, controle: 'non_detecte', couleur_detectee: null })).toEqual({
      pb_controle_photo: 'non_detecte',
      pb_couleur_detectee: null,
    });
  });
});
