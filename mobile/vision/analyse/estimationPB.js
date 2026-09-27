/**
 * estimationPB.js
 * Combine la largeur de bras détectée dans les pixels (largeurBras.js) et le facteur
 * de calibration (useCalibration.js) pour produire une estimation du PB.
 *
 * Modèle géométrique inchangé par rapport à l'ancienne heuristique (bras approximé par
 * un cylindre vu de face : PB ≈ π × diamètre visible) — ce qui change, c'est que le
 * diamètre vient maintenant d'une vraie mesure sur l'image, pas d'une fraction fixe
 * du cadre.
 *
 * Référence : AnthroNet (JMIR, preprint non relu, n=200) — non intégré ici, mentionné
 * pour mémoire comme dans l'ancienne implémentation.
 */

import { pxToCm, cmToMm } from '../hooks/useCalibration';
import { mesurerLargeurBras } from './largeurBras';

// Plage physiologique plausible pour le PB (mm), tous âges confondus (nourrisson à
// adulte) : sert à rejeter une détection manifestement fausse plutôt que de l'afficher.
export const PB_MIN_MM = 60;
export const PB_MAX_MM = 300;

/**
 * @param {ArrayLike<number>} rgba - pixels RGBA de la zone recadrée
 * @param {number} largeurImg
 * @param {number} hauteurImg
 * @param {number} pixelsPerCm - facteur de calibration (voir useCalibration.confirmCalibration)
 * @returns {{valeurMm:number, scoreConfiance:number, scoreQualite:number, largeurBrasPx:number} | null}
 */
export function estimerPBDepuisPixels(rgba, largeurImg, hauteurImg, pixelsPerCm) {
  const mesure = mesurerLargeurBras(rgba, largeurImg, hauteurImg);
  if (!mesure) return null;

  const diametreCm = pxToCm(mesure.largeurPx, pixelsPerCm);
  if (diametreCm === null || diametreCm <= 0) return null;

  const pbMm = cmToMm(Math.PI * diametreCm);
  if (pbMm < PB_MIN_MM || pbMm > PB_MAX_MM) return null;

  return {
    valeurMm: pbMm,
    scoreConfiance: mesure.confiance,
    scoreQualite: Math.min(1, mesure.nLignesUtilisees / 5),
    largeurBrasPx: mesure.largeurPx,
  };
}
