import { describe, expect, it } from 'vitest';
import { ETAPES_TEST_PRESSION } from '../services/testPression';

describe('guide du test de pression (protocole PCIMA)', () => {
  it('décrit le geste en trois étapes, sur les deux pieds', () => {
    expect(ETAPES_TEST_PRESSION).toHaveLength(3);
    const texte = ETAPES_TEST_PRESSION.join(' ').toLowerCase();
    expect(texte).toContain('3 secondes');
    expect(texte).toContain('godet');
    expect(texte).toContain('deux pieds');
    expect(texte).toContain('un seul pied ne compte pas');
  });
});
