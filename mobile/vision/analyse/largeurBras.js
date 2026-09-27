/**
 * largeurBras.js
 * Détection de la largeur du bras à partir des pixels réels de la photo — remplace
 * l'ancienne hypothèse fixe ("le bras occupe 60 % du cadre") par une vraie mesure.
 *
 * Principe (par ligne horizontale) :
 *   1. On échantillonne la couleur moyenne du fond aux deux extrémités de la ligne
 *      (l'agent centre le bras dans la zone de guidage : si le cadrage est correct,
 *      un peu de fond est visible de chaque côté, sauf si le bras remplit toute la
 *      largeur — cas volontairement traité comme valide, pas comme un échec).
 *   2. On avance depuis chaque bord vers le centre jusqu'à la première rupture de
 *      couleur nette (SEUIL_CONTRASTE) : c'est le bord du bras.
 *   3. Plusieurs lignes sont échantillonnées autour du centre vertical de la zone
 *      (là où l'agent a été guidé à centrer le point mi-épaule-coude) ; leur accord
 *      entre elles nourrit le score de confiance.
 *
 * Aucune détection n'est présentée comme fiable si le signal est faible : mieux vaut
 * renvoyer null (→ reprise ou saisie manuelle) qu'inventer un chiffre, comme pour
 * l'ancienne heuristique qu'on remplace ici.
 */

import { distanceCouleur } from './couleurPeau';

// Distance de couleur au-delà de laquelle un pixel marque une rupture avec le fond.
// Valeur empirique de départ — à ajuster après des essais sur photos réelles variées
// (éclairage, tons de peau, arrière-plans).
export const SEUIL_CONTRASTE = 28;

// Fraction de la largeur de ligne échantillonnée à chaque extrémité pour estimer le fond.
const FRACTION_BORD_FOND = 0.08;

// Nombre de lignes et bande verticale (fraction de la hauteur de la zone) explorées.
const N_LIGNES_DEFAUT = 5;
const BANDE_VERTICALE_DEFAUT = 0.5;

// Fraction minimale de lignes exploitables pour accepter une mesure.
const FRACTION_MIN_LIGNES_VALIDES = 0.6;

function moyenneCouleur(rgba, largeur, y, xDebut, xFin) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let x = xDebut; x < xFin; x += 1) {
    const i = (y * largeur + x) * 4;
    r += rgba[i];
    g += rgba[i + 1];
    b += rgba[i + 2];
    n += 1;
  }
  return n > 0 ? { r: r / n, g: g / n, b: b / n } : { r: 0, g: 0, b: 0 };
}

/**
 * Analyse une ligne horizontale de pixels RGBA (format jpeg-js : 4 octets/pixel,
 * R,G,B,A à la suite) pour trouver les bords gauche et droit du bras.
 *
 * @param {ArrayLike<number>} rgba
 * @param {number} largeur - largeur de l'image en pixels
 * @param {number} y - ligne analysée
 * @returns {{gauche:number, droite:number, largeurPx:number, contrasteGauche:number, contrasteDroite:number} | null}
 */
export function detecterLargeurLigne(rgba, largeur, y) {
  if (largeur < 10 || y < 0) return null;

  const nBord = Math.max(1, Math.round(largeur * FRACTION_BORD_FOND));
  const fondGauche = moyenneCouleur(rgba, largeur, y, 0, nBord);
  const fondDroite = moyenneCouleur(rgba, largeur, y, largeur - nBord, largeur);

  let gauche = 0;
  let contrasteGauche = 0;
  for (let x = 0; x < largeur; x += 1) {
    const i = (y * largeur + x) * 4;
    const d = distanceCouleur(rgba[i], rgba[i + 1], rgba[i + 2], fondGauche.r, fondGauche.g, fondGauche.b);
    if (d >= SEUIL_CONTRASTE) {
      gauche = x;
      contrasteGauche = d;
      break;
    }
    // Pas de rupture sur toute la ligne : le bras occupe l'image depuis ce bord
    // (capture bien cadrée, sans fond visible de ce côté) — pas un échec.
    if (x === largeur - 1) gauche = 0;
  }

  let droite = largeur - 1;
  let contrasteDroite = 0;
  for (let x = largeur - 1; x >= 0; x -= 1) {
    const i = (y * largeur + x) * 4;
    const d = distanceCouleur(rgba[i], rgba[i + 1], rgba[i + 2], fondDroite.r, fondDroite.g, fondDroite.b);
    if (d >= SEUIL_CONTRASTE) {
      droite = x;
      contrasteDroite = d;
      break;
    }
    if (x === 0) droite = largeur - 1;
  }

  if (droite <= gauche) return null;
  return { gauche, droite, largeurPx: droite - gauche, contrasteGauche, contrasteDroite };
}

/**
 * Mesure la largeur du bras sur une image RGBA déjà recadrée sur la zone de guidage
 * (voir mobile/vision/analyse/photo.js pour le recadrage depuis la photo complète).
 *
 * @param {ArrayLike<number>} rgba
 * @param {number} largeur
 * @param {number} hauteur
 * @param {{nLignes?:number, bandeVerticale?:number}} [options]
 * @returns {{largeurPx:number, confiance:number, nLignesUtilisees:number, dispersion:number} | null}
 */
export function mesurerLargeurBras(rgba, largeur, hauteur, options = {}) {
  const nLignes = options.nLignes ?? N_LIGNES_DEFAUT;
  const bandeVerticale = options.bandeVerticale ?? BANDE_VERTICALE_DEFAUT;

  if (largeur < 10 || hauteur < nLignes) return null;

  const yCentre = Math.round(hauteur / 2);
  const demiBande = Math.max(1, Math.round((hauteur * bandeVerticale) / 2));
  const pas = nLignes > 1 ? (demiBande * 2) / (nLignes - 1) : 0;

  const resultats = [];
  for (let i = 0; i < nLignes; i += 1) {
    const y = Math.min(hauteur - 1, Math.max(0, Math.round(yCentre - demiBande + i * pas)));
    const r = detecterLargeurLigne(rgba, largeur, y);
    if (r) resultats.push(r);
  }

  if (resultats.length < Math.ceil(nLignes * FRACTION_MIN_LIGNES_VALIDES)) return null;

  const largeurs = resultats.map((r) => r.largeurPx).sort((a, b) => a - b);
  const mediane = largeurs[Math.floor(largeurs.length / 2)];
  if (mediane <= 0) return null;

  const ecarts = largeurs.map((l) => Math.abs(l - mediane));
  const ecartMoyen = ecarts.reduce((a, b) => a + b, 0) / ecarts.length;
  const dispersion = ecartMoyen / mediane; // 0 = lignes parfaitement d'accord

  const contrasteMoyen =
    resultats.reduce((a, r) => a + (r.contrasteGauche + r.contrasteDroite) / 2, 0) / resultats.length;

  // Confiance : cohérence entre lignes + netteté des bords détectés. Plafonnée
  // volontairement (jamais > 0.85) : c'est toujours une heuristique non validée
  // cliniquement, jamais une mesure certaine (cf. règle d'or CONTRAT_INTERFACE.md).
  const scoreCoherence = Math.max(0, 1 - dispersion * 2);
  const scoreContraste = Math.min(1, contrasteMoyen / (SEUIL_CONTRASTE * 2));
  const confiance = Math.min(0.85, 0.5 * scoreCoherence + 0.5 * scoreContraste);

  return { largeurPx: mediane, confiance, nLignesUtilisees: resultats.length, dispersion };
}
