import { describe, expect, it } from 'vitest';
import { oedemesVersApi } from '../services/mappings';

describe('oedemesVersApi', () => {
  it('Oui -> true, Non -> false', () => {
    expect(oedemesVersApi('Oui')).toBe(true);
    expect(oedemesVersApi('Non')).toBe(false);
  });
  it('Incertain -> true (orientation prudente), jamais une chaîne que le backend rejetterait', () => {
    expect(oedemesVersApi('Incertain')).toBe(true);
    expect(typeof oedemesVersApi('Incertain')).toBe('boolean');
  });
});
