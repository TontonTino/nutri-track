/**
 * zoneGuidage.js
 * Définition de la zone où l'agent doit centrer le bras (mi-hauteur épaule-coude),
 * affichée par GuidingOverlay et réutilisée par mobile/vision/analyse/photo.js pour
 * savoir quelle portion de la photo analyser.
 *
 * Une seule source de vérité : si la zone affichée à l'écran et la zone analysée
 * divergent, l'analyse porterait sur une portion de l'image que l'agent n'a pas
 * vue — à éviter absolument.
 */

export const ZONE_W_RATIO = 0.60;   // largeur de la zone, en fraction de la largeur d'écran
export const ZONE_H_RATIO = 0.30;   // hauteur de la zone, en fraction de la hauteur d'écran
export const ZONE_TOP_RATIO = 0.20; // position du haut de la zone, en fraction de la hauteur d'écran

/**
 * Rectangle de la zone de guidage en coordonnées d'affichage (dp), pour un écran
 * de dimensions données.
 *
 * @param {number} displayWidth
 * @param {number} displayHeight
 * @returns {{x:number, y:number, width:number, height:number}}
 */
export function zoneGuidageDp(displayWidth, displayHeight) {
  const width = displayWidth * ZONE_W_RATIO;
  const height = displayHeight * ZONE_H_RATIO;
  return {
    x: (displayWidth - width) / 2,
    y: displayHeight * ZONE_TOP_RATIO,
    width,
    height,
  };
}
