import { describe, expect, it } from 'vitest';
import { erreurOedemes, MESSAGE_TEST_REQUIS, oedemesVersApi } from '../services/mappings';

describe('oedemesVersApi', () => {
  it('Oui -> true, Non -> false', () => {
    expect(oedemesVersApi('Oui')).toBe(true);
    expect(oedemesVersApi('Non')).toBe(false);
  });

  it("« Incertain » n'est jamais envoyé : le doute se tranche par le test de pression (ni faux « sévère », ni cas manqué)", () => {
    expect(() => oedemesVersApi('Incertain')).toThrow('test de pression');
  });
});

describe('erreurOedemes (validation du formulaire)', () => {
  it('une réponse tranchée est valide', () => {
    expect(erreurOedemes('Oui')).toBeUndefined();
    expect(erreurOedemes('Non')).toBeUndefined();
  });

  it("« Incertain » bloque la validation et demande le test de pression", () => {
    expect(erreurOedemes('Incertain')).toBe(MESSAGE_TEST_REQUIS);
    expect(MESSAGE_TEST_REQUIS).toContain('test de pression');
  });

  it("l'absence de réponse est refusée", () => {
    expect(erreurOedemes(null)).toBe('Choisissez Oui, Non ou Incertain.');
  });
});
