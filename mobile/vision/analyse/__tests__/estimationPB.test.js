import { describe, expect, it } from 'vitest';
import { estimerPBDepuisPixels, PB_MIN_MM, PB_MAX_MM } from '../estimationPB';

const FOND = { r: 225, g: 225, b: 228 };
const BRAS = { r: 175, g: 130, b: 100 };

function construireImage(largeur, hauteur, gaucheBras, droiteBras) {
  const rgba = new Uint8ClampedArray(largeur * hauteur * 4);
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const estBras = x >= gaucheBras && x <= droiteBras;
      const base = estBras ? BRAS : FOND;
      const i = (y * largeur + x) * 4;
      rgba[i] = base.r;
      rgba[i + 1] = base.g;
      rgba[i + 2] = base.b;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

describe('estimerPBDepuisPixels', () => {
  it('calcule un PB plausible à partir d\'une largeur détectée et d\'une calibration réaliste', () => {
    const largeur = 200;
    const hauteur = 80;
    // Bras de 60 px de large. Calibration : 20 px/cm (valeur réaliste pour une carte
    // bancaire de 8,56 cm occupant environ 170 px de large sur une photo recadrée).
    const rgba = construireImage(largeur, hauteur, 70, 129);
    const pixelsPerCm = 20;

    const r = estimerPBDepuisPixels(rgba, largeur, hauteur, pixelsPerCm);
    expect(r).not.toBeNull();

    // largeurPx ≈ 60 -> diamètre ≈ 3 cm -> PB ≈ π × 3 ≈ 9.42 cm ≈ 94 mm
    expect(r.valeurMm).toBeGreaterThan(85);
    expect(r.valeurMm).toBeLessThan(105);
    expect(r.scoreConfiance).toBeGreaterThan(0);
    expect(r.scoreConfiance).toBeLessThanOrEqual(0.85);
  });

  it('rejette un résultat hors de la plage physiologique plausible plutôt que de l\'inventer', () => {
    const largeur = 200;
    const hauteur = 80;
    // Bras qui occupe presque toute la largeur avec une calibration à faible résolution :
    // le diamètre calculé donnerait un PB totalement irréaliste (> PB_MAX_MM).
    const rgba = construireImage(largeur, hauteur, 2, 197);
    const pixelsPerCm = 2; // calibration très grossière, volontairement irréaliste ici

    const r = estimerPBDepuisPixels(rgba, largeur, hauteur, pixelsPerCm);
    expect(r).toBeNull();
  });

  it('renvoie null si la détection de largeur elle-même échoue (image trop petite)', () => {
    const rgba = construireImage(120, 2, 30, 89); // hauteur < nombre de lignes échantillonnées
    expect(estimerPBDepuisPixels(rgba, 120, 2, 20)).toBeNull();
  });

  it('exporte des bornes de plausibilité cohérentes (min < max)', () => {
    expect(PB_MIN_MM).toBeLessThan(PB_MAX_MM);
  });
});
