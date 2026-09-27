import { describe, expect, it } from 'vitest';
import { zoneGuidageDp, zoneEcranVersPhoto } from '../zoneGuidage';

// Vérifie qu'une zone convertie reste toujours strictement à l'intérieur de
// la photo — c'est exactement l'absence de cette garantie qui causait
// « Invalid crop options » côté expo-image-manipulator sur un vrai téléphone.
function verifierDansLesLimites(zone, imageWidth, imageHeight) {
  expect(zone.originX).toBeGreaterThanOrEqual(0);
  expect(zone.originY).toBeGreaterThanOrEqual(0);
  expect(zone.originX + zone.width).toBeLessThanOrEqual(imageWidth);
  expect(zone.originY + zone.height).toBeLessThanOrEqual(imageHeight);
  expect(zone.width).toBeGreaterThan(0);
  expect(zone.height).toBeGreaterThan(0);
}

describe('zoneEcranVersPhoto', () => {
  it('reproduit le cas réel : écran ~20:9, photo caméra 16:9 (le bug observé sur le terrain)', () => {
    // Chiffres représentatifs d'un téléphone Android courant.
    const displayWidth = 1080;
    const displayHeight = 2400; // ratio 0.45
    const imageWidth = 1080;
    const imageHeight = 1920; // photo 16:9 -> ratio 0.5625, différent de l'écran

    const zoneDp = zoneGuidageDp(displayWidth, displayHeight);
    const zone = zoneEcranVersPhoto(zoneDp, displayWidth, displayHeight, imageWidth, imageHeight);

    verifierDansLesLimites(zone, imageWidth, imageHeight);
  });

  it('recadre sur la largeur quand l\'écran est plus étroit que la photo (portrait très allongé)', () => {
    const displayWidth = 1080;
    const displayHeight = 2400;
    const imageWidth = 1200;
    const imageHeight = 1600; // ratio 0.75, écran (0.45) plus étroit -> coupe gauche/droite

    // Zone couvrant tout l'écran : doit correspondre à moins que toute la largeur de la photo.
    const zone = zoneEcranVersPhoto({ x: 0, y: 0, width: displayWidth, height: displayHeight }, displayWidth, displayHeight, imageWidth, imageHeight);

    verifierDansLesLimites(zone, imageWidth, imageHeight);
    expect(zone.width).toBeLessThan(imageWidth); // les côtés de la photo sont hors écran
    expect(zone.height).toBeCloseTo(imageHeight, 0); // toute la hauteur de la photo est visible
  });

  it('recadre sur la hauteur quand l\'écran est plus large que la photo', () => {
    const displayWidth = 1600;
    const displayHeight = 1000; // ratio 1.6
    const imageWidth = 1200;
    const imageHeight = 1600; // ratio 0.75, écran plus large -> coupe haut/bas

    const zone = zoneEcranVersPhoto({ x: 0, y: 0, width: displayWidth, height: displayHeight }, displayWidth, displayHeight, imageWidth, imageHeight);

    verifierDansLesLimites(zone, imageWidth, imageHeight);
    expect(zone.height).toBeLessThan(imageHeight);
    expect(zone.width).toBeCloseTo(imageWidth, 0);
  });

  it('ne change rien quand écran et photo ont exactement le même rapport d\'aspect', () => {
    const displayWidth = 1080;
    const displayHeight = 1920;
    const imageWidth = 1080;
    const imageHeight = 1920; // même ratio que l'écran

    const zoneDp = { x: 200, y: 300, width: 600, height: 500 };
    const zone = zoneEcranVersPhoto(zoneDp, displayWidth, displayHeight, imageWidth, imageHeight);

    // Même ratio -> simple mise à l'échelle uniforme (ici x1), sans marge.
    expect(zone.originX).toBeCloseTo(200, 0);
    expect(zone.originY).toBeCloseTo(300, 0);
    expect(zone.width).toBeCloseTo(600, 0);
    expect(zone.height).toBeCloseTo(500, 0);
  });

  it('reste dans les limites même pour une zone touchant les bords de l\'écran', () => {
    const displayWidth = 1080;
    const displayHeight = 2340;
    const imageWidth = 4000;
    const imageHeight = 3000; // rapport très différent, dans l'autre sens

    const zone = zoneEcranVersPhoto({ x: 0, y: 0, width: displayWidth, height: displayHeight }, displayWidth, displayHeight, imageWidth, imageHeight);
    verifierDansLesLimites(zone, imageWidth, imageHeight);
  });

  it('reste dans les limites pour la vraie zone de guidage, sur un grand échantillon de rapports d\'écran/photo', () => {
    const combinaisons = [
      [1080, 2400, 1080, 1920],
      [1080, 2340, 1440, 1080],
      [828, 1792, 3024, 4032],
      [1440, 3120, 1200, 1600],
      [750, 1334, 1334, 750],
    ];
    for (const [dw, dh, iw, ih] of combinaisons) {
      const zoneDp = zoneGuidageDp(dw, dh);
      const zone = zoneEcranVersPhoto(zoneDp, dw, dh, iw, ih);
      verifierDansLesLimites(zone, iw, ih);
    }
  });
});
