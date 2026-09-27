/**
 * zoneDepuisPose.js
 * Transforme le résultat de PoseWebView (épaule/coude détectés) en une zone
 * de recadrage exprimée en pixels réels de la photo, pour analyse/photo.js.
 *
 * Ne fait aucune mesure elle-même — seulement "où regarder". La largeur du
 * bras est toujours mesurée par analyse/largeurBras.js, sur cette zone.
 */

// Score MoveNet minimal (0-1) pour faire confiance à un point clé. En dessous,
// mieux vaut retomber sur la zone de guidage fixe que sur une position
// approximative.
export const CONFIANCE_MIN_POSE = 0.3;

// Taille de la zone recadrée autour du point milieu épaule-coude, en fraction
// des dimensions réelles de la photo. Volontairement généreuse : compense
// l'imprécision du modèle sans redevenir aussi large que la zone de guidage
// fixe qu'elle remplace.
const ZONE_LARGEUR_RATIO = 0.35;
const ZONE_HAUTEUR_RATIO = 0.20;

/**
 * @param {{gauche: {milieu:{x:number,y:number}, confiance:number}|null,
 *          droite: {milieu:{x:number,y:number}, confiance:number}|null,
 *          largeurImage: number, hauteurImage: number}} resultatPose
 *        - largeurImage/hauteurImage : dimensions de l'image telle qu'analysée
 *          par MoveNet (peut être une version réduite de la photo réelle).
 * @param {number} largeurImageReelle - largeur réelle de la photo capturée (px)
 * @param {number} hauteurImageReelle - hauteur réelle de la photo capturée (px)
 * @returns {{originX:number, originY:number, width:number, height:number} | null}
 */
export function zoneDepuisPose(resultatPose, largeurImageReelle, hauteurImageReelle) {
  if (!resultatPose || !resultatPose.largeurImage || !resultatPose.hauteurImage) return null;
  if (!largeurImageReelle || !hauteurImageReelle) return null;

  const cotes = [resultatPose.gauche, resultatPose.droite].filter(
    (c) => c && c.confiance >= CONFIANCE_MIN_POSE,
  );
  if (cotes.length === 0) return null;

  // Le côté le plus confiant : celui dont l'épaule ET le coude sont le mieux
  // vus (l'autre bras, hors cadre ou masqué, obtient naturellement un score
  // bas — pas besoin de demander à l'agent de préciser quel bras).
  const meilleur = cotes.reduce((a, b) => (b.confiance > a.confiance ? b : a));

  const echelle = largeurImageReelle / resultatPose.largeurImage;
  const centreX = meilleur.milieu.x * echelle;
  const centreY = meilleur.milieu.y * echelle;

  const largeurZone = largeurImageReelle * ZONE_LARGEUR_RATIO;
  const hauteurZone = hauteurImageReelle * ZONE_HAUTEUR_RATIO;

  const originX = Math.max(0, Math.min(largeurImageReelle - largeurZone, centreX - largeurZone / 2));
  const originY = Math.max(0, Math.min(hauteurImageReelle - hauteurZone, centreY - hauteurZone / 2));

  return {
    originX: Math.round(originX),
    originY: Math.round(originY),
    width: Math.round(Math.min(largeurZone, largeurImageReelle)),
    height: Math.round(Math.min(hauteurZone, hauteurImageReelle)),
  };
}
