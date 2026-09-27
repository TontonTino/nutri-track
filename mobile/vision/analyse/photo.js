/**
 * photo.js
 * Recadre la photo capturée sur la zone de guidage (là où l'agent a centré le bras),
 * décode ses pixels, et en tire une estimation du PB. Tout se passe sur le téléphone,
 * sans réseau. La copie réduite créée pour l'analyse est effacée juste après (les
 * photos liées à une mesure de santé ne sont jamais conservées au-delà de l'usage).
 *
 * Ce module dépend de expo-image-manipulator et jpeg-js, déjà utilisés ailleurs dans
 * l'application (mobile/src/brassard/) pour un besoin voisin — mais mobile/vision/
 * n'importe rien de mobile/src/ : ce module reste autonome (voir couleurPeau.js).
 */

import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';

import { zoneGuidageDp } from '../constants/zoneGuidage';
import { estimerPBDepuisPixels } from './estimationPB';

// La région recadrée est réduite à cette largeur avant décodage : suffisant pour
// repérer un contour net, très rapide à décoder (quelques dizaines de ms).
const LARGEUR_ANALYSE = 200;

// base64 -> octets, sans dépendre de Buffer ni de atob (absents ou inégaux selon la
// plateforme). Duplique intentionnellement la fonction homonyme de
// mobile/src/brassard/couleur.ts : voir la note d'autonomie ci-dessus.
function base64VersOctets(base64) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const propre = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const octets = new Uint8Array(Math.floor((propre.length * 3) / 4));
  let sortie = 0;
  for (let i = 0; i < propre.length; i += 4) {
    const a = alphabet.indexOf(propre[i]);
    const b = alphabet.indexOf(propre[i + 1]);
    const c = i + 2 < propre.length ? alphabet.indexOf(propre[i + 2]) : -1;
    const d = i + 3 < propre.length ? alphabet.indexOf(propre[i + 3]) : -1;
    octets[sortie] = (a << 2) | (b >> 4);
    sortie += 1;
    if (c >= 0) {
      octets[sortie] = ((b & 15) << 4) | (c >> 2);
      sortie += 1;
    }
    if (d >= 0) {
      octets[sortie] = ((c & 3) << 6) | d;
      sortie += 1;
    }
  }
  return octets.slice(0, sortie);
}

function supprimerPhotoReduite(uri) {
  if (!uri) return;
  try {
    new File(uri).delete();
  } catch {
    // Fichier déjà supprimé ou inaccessible : rien à faire.
  }
}

/**
 * @param {string} uri - URI de la photo capturée (PBCaptureScreen)
 * @param {object} params
 * @param {number} params.imageWidth - largeur réelle de l'image en px
 * @param {number} params.imageHeight - hauteur réelle de l'image en px
 * @param {number} params.displayWidth - largeur de l'écran en dp au moment de la capture
 * @param {number} params.displayHeight - hauteur de l'écran en dp au moment de la capture
 * @param {number} params.pixelsPerCm - facteur de calibration confirmé par l'agent
 * @returns {Promise<{valeurMm:number, scoreConfiance:number, scoreQualite:number, largeurBrasPx:number} | null>}
 */
export async function analyserPhotoBras(uri, params) {
  const { imageWidth, imageHeight, displayWidth, displayHeight, pixelsPerCm } = params;
  if (!uri || !imageWidth || !imageHeight || !displayWidth || !displayHeight || !pixelsPerCm) {
    return null;
  }

  const zoneDp = zoneGuidageDp(displayWidth, displayHeight);
  const scaleX = imageWidth / displayWidth;
  const scaleY = imageHeight / displayHeight;

  const region = {
    originX: Math.max(0, Math.round(zoneDp.x * scaleX)),
    originY: Math.max(0, Math.round(zoneDp.y * scaleY)),
    width: Math.max(1, Math.min(imageWidth, Math.round(zoneDp.width * scaleX))),
    height: Math.max(1, Math.min(imageHeight, Math.round(zoneDp.height * scaleY))),
  };

  const contexte = ImageManipulator.manipulate(uri);
  contexte.crop(region).resize({ width: LARGEUR_ANALYSE });
  const image = await contexte.renderAsync();
  const reduit = await image.saveAsync({ format: SaveFormat.JPEG, base64: true, compress: 0.9 });

  try {
    if (!reduit.base64) return null;
    const pixels = decode(base64VersOctets(reduit.base64), { useTArray: true, formatAsRGBA: true });
    return estimerPBDepuisPixels(pixels.data, pixels.width, pixels.height, pixelsPerCm);
  } finally {
    supprimerPhotoReduite(reduit.uri);
  }
}
