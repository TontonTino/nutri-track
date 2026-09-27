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

/**
 * Convertit une zone exprimée en coordonnées d'écran (dp) vers des pixels
 * réels de la photo capturée.
 *
 * Ce n'est PAS une simple règle de trois (imageWidth/displayWidth) : l'aperçu
 * caméra remplit l'écran en mode « cover », et l'écran du téléphone n'a
 * presque jamais le même rapport largeur/hauteur que la photo capturée
 * (ex. caméra en 16:9, écran en ~20:9). Le mode « cover » ne déforme pas
 * l'image, il en affiche seulement une partie : soit les bords gauche/droite
 * de la photo sont hors écran (photo plus « large » que l'écran ne le
 * montre), soit c'est le haut/bas. Ignorer ça revient à mal placer la zone
 * réellement analysée par rapport à ce que l'agent a vu et cadré — l'erreur
 * qui causait « Invalid crop options » quand la zone calculée débordait de
 * la photo.
 *
 * @param {{x:number,y:number,width:number,height:number}} zoneEcran - en dp
 * @param {number} displayWidth - largeur de l'écran (dp)
 * @param {number} displayHeight - hauteur de l'écran (dp)
 * @param {number} imageWidth - largeur réelle de la photo (px)
 * @param {number} imageHeight - hauteur réelle de la photo (px)
 * @returns {{originX:number, originY:number, width:number, height:number}}
 */
export function zoneEcranVersPhoto(zoneEcran, displayWidth, displayHeight, imageWidth, imageHeight) {
  const ratioEcran = displayWidth / displayHeight;
  const ratioPhoto = imageWidth / imageHeight;

  // Fraction de la largeur/hauteur RÉELLE de la photo effectivement visible
  // à l'écran (le reste est hors cadre, coupé par le mode « cover »).
  let fractionVisibleX = 1;
  let fractionVisibleY = 1;
  if (ratioEcran < ratioPhoto) {
    // Écran plus étroit que la photo à hauteur égale : les côtés de la photo
    // débordent de l'écran (coupés à gauche/droite).
    fractionVisibleX = ratioEcran / ratioPhoto;
  } else if (ratioEcran > ratioPhoto) {
    // Écran plus large que la photo à largeur égale : le haut/bas de la
    // photo déborde de l'écran (coupé en haut/bas).
    fractionVisibleY = ratioPhoto / ratioEcran;
  }

  const margeX = (1 - fractionVisibleX) / 2; // fraction de la photo coupée de CHAQUE côté
  const margeY = (1 - fractionVisibleY) / 2;

  const xFractionEcran = zoneEcran.x / displayWidth;
  const yFractionEcran = zoneEcran.y / displayHeight;
  const wFractionEcran = zoneEcran.width / displayWidth;
  const hFractionEcran = zoneEcran.height / displayHeight;

  const xFractionPhoto = margeX + xFractionEcran * fractionVisibleX;
  const yFractionPhoto = margeY + yFractionEcran * fractionVisibleY;
  const wFractionPhoto = wFractionEcran * fractionVisibleX;
  const hFractionPhoto = hFractionEcran * fractionVisibleY;

  const originX = Math.max(0, Math.min(imageWidth - 1, Math.round(xFractionPhoto * imageWidth)));
  const originY = Math.max(0, Math.min(imageHeight - 1, Math.round(yFractionPhoto * imageHeight)));
  // Clampée pour ne JAMAIS déborder de la photo, même en cas d'arrondi limite.
  const width = Math.max(1, Math.min(imageWidth - originX, Math.round(wFractionPhoto * imageWidth)));
  const height = Math.max(1, Math.min(imageHeight - originY, Math.round(hFractionPhoto * imageHeight)));

  return { originX, originY, width, height };
}
