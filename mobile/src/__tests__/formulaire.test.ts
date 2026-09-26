import { describe, expect, it } from 'vitest';
import { ApiError } from '../services/apiError';
import { dateDuJour, dateValide, erreurPourFormulaire, versEntier, versNombre } from '../services/formulaire';

describe('versNombre / versEntier', () => {
  it('accepte la virgule décimale', () => {
    expect(versNombre('9,5')).toBe(9.5);
    expect(versNombre(' 112 ')).toBe(112);
  });
  it('refuse le vide et le non numérique', () => {
    expect(versNombre('')).toBeNull();
    expect(versNombre('abc')).toBeNull();
    expect(versNombre('12abc')).toBeNull();
  });
  it('versEntier refuse les décimaux', () => {
    expect(versEntier('28')).toBe(28);
    expect(versEntier('28,5')).toBeNull();
  });
});

describe('dateValide', () => {
  const ref = new Date('2026-09-26T12:00:00Z');
  it('accepte une date réelle passée ou du jour', () => {
    expect(dateValide('2026-09-26', ref)).toBe(true);
    expect(dateValide('2026-01-15', ref)).toBe(true);
  });
  it('refuse futur, format incorrect et dates inexistantes', () => {
    expect(dateValide('2026-12-01', ref)).toBe(false);
    expect(dateValide('26/09/2026', ref)).toBe(false);
    expect(dateValide('2026-02-30', ref)).toBe(false);
  });
  it('dateDuJour formate AAAA-MM-JJ', () => {
    expect(dateDuJour(new Date(2026, 8, 5))).toBe('2026-09-05');
  });
});

describe('erreurPourFormulaire', () => {
  const libelles = { pb: 'Périmètre brachial' };
  it('cible le champ fautif sans toucher aux autres', () => {
    const r = erreurPourFormulaire(new ApiError('hors_plage', 'trop grand', 'pb'), libelles);
    expect(r.erreurs).toEqual({ pb: 'trop grand' });
    expect(r.general).toBe('Valeur à corriger : Périmètre brachial.');
  });
  it('gère une erreur hors plage sans champ identifié', () => {
    const r = erreurPourFormulaire(new ApiError('hors_plage', 'message'), libelles);
    expect(r.erreurs).toEqual({});
    expect(r.general).toBe('message');
  });
  it('gère une erreur réseau', () => {
    const r = erreurPourFormulaire(new ApiError('reseau', 'Serveur injoignable'), libelles);
    expect(r.general).toBe('Serveur injoignable');
  });
});
