// Lecture assistée du brassard PB : logique pure (testable).
// Le brassard PB est l'instrument de référence du dépistage : une bande graduée en mm, colorée en trois zones
// (rouge < 115 mm, jaune/orange 115 à 124 mm, vert ≥ 125 mm, protocole PCIMA). L'agent lit la valeur ; la caméra
// photographie la bande et l'app CONTRÔLE que la couleur visible correspond à la valeur saisie, pour repérer une erreur
// de lecture ou de frappe. Ce contrôle est indicatif : il n'entre jamais dans le classement (moteur du serveur).

export type ZoneBrassard = 'rouge' | 'jaune' | 'vert';
export type ControleCouleur = 'coherent' | 'incoherent' | 'non_detecte';

// Seuils du protocole (table Seuils d'Alya : pb_severe 115, pb_modere 125). Servent uniquement à colorer l'aide et à
// contrôler la couleur ; la classification reste celle du serveur.
export const SEUILS_ZONES_MM = { rougeSous: 115, jauneSous: 125 } as const;

export function zoneDepuisPb(mm: number): ZoneBrassard {
  if (mm < SEUILS_ZONES_MM.rougeSous) return 'rouge';
  if (mm < SEUILS_ZONES_MM.jauneSous) return 'jaune';
  return 'vert';
}

export interface Hsv {
  h: number; // 0-360
  s: number; // 0-1
  v: number; // 0-1
}

export function rgbVersHsv(r: number, g: number, b: number): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

// Couleur d'un pixel, ou null si elle n'est pas assez saturée pour être celle d'une bande de brassard. Les seuils de
// saturation sont plus stricts pour le jaune et le rouge, dont les teintes voisinent celles de la peau.
export function zoneDuPixel(r: number, g: number, b: number): ZoneBrassard | null {
  const { h, s, v } = rgbVersHsv(r, g, b);
  if ((h <= 12 || h >= 345) && s >= 0.6 && v >= 0.3) return 'rouge';
  if (h >= 22 && h <= 70 && s >= 0.65 && v >= 0.5) return 'jaune';
  if (h >= 80 && h <= 170 && s >= 0.35 && v >= 0.25) return 'vert';
  return null;
}

export interface AnalyseCouleur {
  detectee: ZoneBrassard | null;
  parts: Record<ZoneBrassard, number>; // nombre de pixels par zone
  pixelsAnalyses: number;
}

export const PART_MIN_PIXELS_COLORES = 0.08; // au moins 8 % de la région doit être colorée
export const PART_MIN_DOMINANTE = 0.6; // et une couleur doit en représenter au moins 60 %

// `rgba` : pixels au format R,G,B,A à la suite. La couleur retenue est la dominante parmi les pixels colorés ;
// sans dominante nette (bande absente, plusieurs couleurs mêlées, image sombre), rien n'est détecté plutôt que de deviner.
export function analyserPixels(rgba: ArrayLike<number>, largeur: number, hauteur: number): AnalyseCouleur {
  const parts: Record<ZoneBrassard, number> = { rouge: 0, jaune: 0, vert: 0 };
  const total = largeur * hauteur;
  for (let i = 0; i < total; i += 1) {
    const zone = zoneDuPixel(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    if (zone) parts[zone] += 1;
  }
  const colores = parts.rouge + parts.jaune + parts.vert;
  let detectee: ZoneBrassard | null = null;
  if (total > 0 && colores / total >= PART_MIN_PIXELS_COLORES) {
    const [zone, nombre] = (Object.entries(parts) as [ZoneBrassard, number][]).sort((a, b) => b[1] - a[1])[0];
    if (nombre / colores >= PART_MIN_DOMINANTE) detectee = zone;
  }
  return { detectee, parts, pixelsAnalyses: total };
}

export function controleCouleur(mm: number, detectee: ZoneBrassard | null): ControleCouleur {
  if (detectee === null) return 'non_detecte';
  return detectee === zoneDepuisPb(mm) ? 'coherent' : 'incoherent';
}

// Région de la photo analysée : le centre, où l'agent place la fenêtre de lecture du brassard (l'aperçu et la photo n'ont
// pas forcément les mêmes proportions : on reste volontairement autour du centre).
export function regionCentrale(largeur: number, hauteur: number) {
  const w = Math.max(Math.round(largeur * 0.4), 1);
  const h = Math.max(Math.round(hauteur * 0.2), 1);
  return {
    originX: Math.round((largeur - w) / 2),
    originY: Math.round((hauteur - h) / 2),
    width: w,
    height: h,
  };
}

// base64 -> octets, sans dépendre de Buffer ni de atob (absents ou inégaux selon la plateforme).
export function base64VersOctets(base64: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const propre = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const octets = new Uint8Array(Math.floor((propre.length * 3) / 4));
  let sortie = 0;
  for (let i = 0; i < propre.length; i += 4) {
    const a = alphabet.indexOf(propre[i]);
    const b = alphabet.indexOf(propre[i + 1]);
    const c = i + 2 < propre.length ? alphabet.indexOf(propre[i + 2]) : -1;
    const d = i + 3 < propre.length ? alphabet.indexOf(propre[i + 3]) : -1;
    octets[sortie++] = (a << 2) | (b >> 4);
    if (c >= 0) octets[sortie++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) octets[sortie++] = ((c & 3) << 6) | d;
  }
  return octets.slice(0, sortie);
}

export const NOM_ZONE: Record<ZoneBrassard, string> = { rouge: 'rouge', jaune: 'jaune', vert: 'vert' };
