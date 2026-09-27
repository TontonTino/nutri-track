import { describe, expect, it } from 'vitest';
import { calculerScoreMna, pertePoidsDepuisReponseB, pointsMollet } from '../services/mna';

describe('calculerScoreMna', () => {
  it('score maximal de 14 : toutes les meilleures réponses, mollet ≥ 31 cm', () => {
    expect(calculerScoreMna({ A: 2, B: 3, C: 2, D: 2, E: 2 }, 31)).toBe(14);
  });
  it('score minimal de 0', () => {
    expect(calculerScoreMna({ A: 0, B: 0, C: 0, D: 0, E: 0 }, 25)).toBe(0);
  });
  it('cas du cahier des charges : un score de 6 est atteignable', () => {
    expect(calculerScoreMna({ A: 1, B: 0, C: 1, D: 2, E: 2 }, 28)).toBe(6);
  });
  it('renvoie null tant que le questionnaire est incomplet', () => {
    expect(calculerScoreMna({ A: 2, B: 3, C: 2, D: 2 }, 31)).toBeNull();
    expect(calculerScoreMna({ A: 2, B: 3, C: 2, D: 2, E: 2 }, null)).toBeNull();
  });
  it('la question F : mollet < 31 cm = 0 point, ≥ 31 cm = 3 points', () => {
    expect(pointsMollet(30.9)).toBe(0);
    expect(pointsMollet(31)).toBe(3);
  });
});

describe('pertePoidsDepuisReponseB', () => {
  it('perte >3 kg ou 1-3 kg : true ; aucune perte : false ; ne sait pas : non renseigné', () => {
    expect(pertePoidsDepuisReponseB(0)).toBe(true);
    expect(pertePoidsDepuisReponseB(2)).toBe(true);
    expect(pertePoidsDepuisReponseB(3)).toBe(false);
    expect(pertePoidsDepuisReponseB(1)).toBeUndefined();
    expect(pertePoidsDepuisReponseB(undefined)).toBeUndefined();
  });
});
