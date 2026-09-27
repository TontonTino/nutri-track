/**
 * photo.js
 * Détermine la zone de la photo à analyser, puis en tire une estimation du PB.
 * Tout se passe sur le téléphone. La copie réduite créée pour l'analyse est
 * effacée juste après (les photos liées à une mesure de santé ne sont jamais
 * conservées au-delà de l'usage).
 *
 * Deux façons de choisir la zone, dans cet ordre de préférence :
 *   1. Détection de pose (épaule/coude réels, voir ../pose/) — plus précise,
 *      demande que le modèle ait pu se charger au moins une fois (réseau).
 *   2. Zone de guidage fixe (l'agent a centré le bras dans le cadre affiché)
 *      — toujours disponible, entièrement hors-ligne, déjà testée en terrain.
 * Dans les deux cas, la mesure de largeur elle-même (../analyse/largeurBras.js)
 * est identique : seule la zone qui lui est passée change.
 *
 * Ce module dépend de expo-image-manipulator et jpeg-js, déjà utilisés ailleurs
 * dans l'application (mobile/src/brassard/) pour un besoin voisin — mais
 * mobile/vision/ n'importe rien de mobile/src/ : ce module reste autonome
 * (voir couleurPeau.js).
 */

import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';

import { zoneGuidageDp } from '../constants/zoneGuidage';
import { zoneDepuisPose } from '../pose/zoneDepuisPose';
import { estimerPBDepuisPixels } from './estimationPB';

// La région recadrée est réduite à cette largeur avant décodage : suffisant pour
// repérer un contour net, très rapide à décoder (quelques dizaines de ms).
const LARGEUR_ANALYSE = 200;

// Largeur de la copie envoyée au modèle de pose : pas besoin de pleine
// résolution pour localiser une épaule et un coude, et une image plus petite
// veut dire une détection plus rapide.
const LARGEUR_POSE = 400;

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

// Zone de guidage fixe (repli), convertie en pixels réels de la photo à
// partir des dimensions d'affichage au moment de la capture.
function zoneFixe(imageWidth, imageHeight, displayWidth, displayHeight) {
  const zoneDp = zoneGuidageDp(displayWidth, displayHeight);
  const scaleX = imageWidth / displayWidth;
  const scaleY = imageHeight / displayHeight;
  return {
    originX: Math.max(0, Math.round(zoneDp.x * scaleX)),
    originY: Math.max(0, Math.round(zoneDp.y * scaleY)),
    width: Math.max(1, Math.min(imageWidth, Math.round(zoneDp.width * scaleX))),
    height: Math.max(1, Math.min(imageHeight, Math.round(zoneDp.height * scaleY))),
  };
}

// Tente la détection de pose sur une copie réduite de la photo entière (il
// faut voir épaule + coude, pas seulement la petite zone de guidage) et
// renvoie la zone qui en découle, ou null si indisponible/peu fiable.
async function zoneParPose(uri, imageWidth, imageHeight, detecterPose) {
  if (!detecterPose) return null;
  try {
    const contexte = ImageManipulator.manipulate(uri);
    contexte.resize({ width: Math.min(LARGEUR_POSE, imageWidth) });
    const image = await contexte.renderAsync();
    const reduite = await image.saveAsync({ format: SaveFormat.JPEG, base64: true, compress: 0.8 });
    if (!reduite.base64) return null;

    const resultatPose = await detecterPose(reduite.base64);
    if (!resultatPose || !resultatPose.trouve) return null;

    return zoneDepuisPose(resultatPose, imageWidth, imageHeight);
  } catch (err) {
    console.error('[photo.js] Détection de pose ignorée (erreur) :', err);
    return null;
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
 * @param {(base64:string) => Promise<object|null>} [params.detecterPose] - voir PoseWebView.detecterPose
 * @returns {Promise<{valeurMm:number, scoreConfiance:number, scoreQualite:number, largeurBrasPx:number, sourceZone:'pose'|'fixe'} | null>}
 */
export async function analyserPhotoBras(uri, params) {
  const { imageWidth, imageHeight, displayWidth, displayHeight, pixelsPerCm, detecterPose } = params;
  if (!uri || !imageWidth || !imageHeight || !displayWidth || !displayHeight || !pixelsPerCm) {
    return null;
  }

  const zonePose = await zoneParPose(uri, imageWidth, imageHeight, detecterPose);
  const sourceZone = zonePose ? 'pose' : 'fixe';
  const region = zonePose ?? zoneFixe(imageWidth, imageHeight, displayWidth, displayHeight);

  const contexte = ImageManipulator.manipulate(uri);
  contexte.crop(region).resize({ width: LARGEUR_ANALYSE });
  const image = await contexte.renderAsync();
  const reduit = await image.saveAsync({ format: SaveFormat.JPEG, base64: true, compress: 0.9 });

  try {
    if (!reduit.base64) return null;
    const pixels = decode(base64VersOctets(reduit.base64), { useTArray: true, formatAsRGBA: true });
    const estimation = estimerPBDepuisPixels(pixels.data, pixels.width, pixels.height, pixelsPerCm);
    return estimation ? { ...estimation, sourceZone } : null;
  } finally {
    supprimerPhotoReduite(reduit.uri);
  }
}
