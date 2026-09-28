import { describe, expect, it } from 'vitest';
import {
  estDansZoneIncertaine,
  MARGE_INCERTITUDE_VISION_MM,
  SEUIL_PB_MODERE_MM,
  SEUIL_PB_SEVERE_MM,
} from '../vision/mesureAssistee';

describe('estDansZoneIncertaine', () => {
  it('signale une mesure juste au-dessus du seuil sévère (le risque : rater un enfant sévère)', () => {
    expect(estDansZoneIncertaine(SEUIL_PB_SEVERE_MM + 5)).toBe(true);
    expect(estDansZoneIncertaine(SEUIL_PB_SEVERE_MM)).toBe(true);
  });

  it('signale une mesure autour du seuil modéré', () => {
    expect(estDansZoneIncertaine(SEUIL_PB_MODERE_MM - 3)).toBe(true);
    expect(estDansZoneIncertaine(SEUIL_PB_MODERE_MM + MARGE_INCERTITUDE_VISION_MM)).toBe(true);
  });

  it('ne signale pas une mesure nettement éloignée des deux seuils', () => {
    expect(estDansZoneIncertaine(90)).toBe(false);
    expect(estDansZoneIncertaine(160)).toBe(false);
  });

  it('couvre la bande complète entre les deux seuils, marge comprise', () => {
    for (let pb = SEUIL_PB_SEVERE_MM - MARGE_INCERTITUDE_VISION_MM; pb <= SEUIL_PB_MODERE_MM + MARGE_INCERTITUDE_VISION_MM; pb += 1) {
      expect(estDansZoneIncertaine(pb)).toBe(true);
    }
    expect(estDansZoneIncertaine(SEUIL_PB_SEVERE_MM - MARGE_INCERTITUDE_VISION_MM - 1)).toBe(false);
    expect(estDansZoneIncertaine(SEUIL_PB_MODERE_MM + MARGE_INCERTITUDE_VISION_MM + 1)).toBe(false);
  });

  it('ignore une valeur non numérique', () => {
    expect(estDansZoneIncertaine(Number.NaN)).toBe(false);
  });
});
