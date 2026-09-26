// Échelle d'interface dynamique : toutes les tailles (polices, espacements, rayons, cibles tactiles, hauteur de courbe,
// largeur de contenu) sont calculées à partir de la largeur et de la hauteur réelles de la fenêtre.
// Aucune taille d'écran n'est codée en dur : les nombres passés à `e()` / `ev()` sont des proportions de conception
// (rapportées à un écran de référence), jamais des pixels absolus.
// Ce module est pur (sans React Native) pour rester testable ; le hook se trouve dans useEchelle.ts.

// Écran de référence de conception : seul point d'ancrage servant à calculer un rapport.
const LARGEUR_REFERENCE = 390;
const HAUTEUR_REFERENCE = 800;

export type ClasseEcran = 'compact' | 'moyen' | 'large';

export interface Echelle {
  largeur: number;
  hauteur: number;
  paysage: boolean;
  classe: ClasseEcran;
  facteur: number;
  /** Dimension proportionnelle à la plus petite dimension de l'écran (polices, espacements, rayons). */
  e: (n: number) => number;
  /** Dimension proportionnelle à la hauteur de l'écran (blocs qui doivent occuper la hauteur). */
  ev: (n: number) => number;
  police: { petit: number; aide: number; corps: number; sousTitre: number; titre: number; grandTitre: number; emoji: number };
  espace: { xs: number; s: number; m: number; l: number; xl: number };
  rayon: { s: number; m: number; l: number };
  trait: number;
  cibleTactile: number;
  /** Largeur maximale du contenu : tout l'écran sur téléphone, colonne centrée sur grand écran. */
  contenuMax: number;
}

export function borner(valeur: number, min: number, max: number): number {
  return Math.min(Math.max(valeur, min), max);
}

const auDemi = (n: number) => Math.round(n * 2) / 2;

export function calculerEchelle(largeur: number, hauteur: number): Echelle {
  const l = Math.max(largeur, 1);
  const h = Math.max(hauteur, 1);
  const courte = Math.min(l, h);
  const facteur = borner(courte / LARGEUR_REFERENCE, 0.85, 1.5);
  const facteurVertical = borner(h / HAUTEUR_REFERENCE, 0.7, 1.4);
  const e = (n: number) => auDemi(n * facteur);
  const ev = (n: number) => auDemi(n * facteurVertical);
  const classe: ClasseEcran = courte < 360 ? 'compact' : courte < 600 ? 'moyen' : 'large';

  return {
    largeur: l,
    hauteur: h,
    paysage: l > h,
    classe,
    facteur,
    e,
    ev,
    police: {
      petit: e(12),
      aide: e(13),
      corps: e(16),
      sousTitre: e(18),
      titre: e(22),
      grandTitre: e(28),
      emoji: e(44),
    },
    espace: { xs: e(4), s: e(8), m: e(12), l: e(18), xl: e(28) },
    rayon: { s: e(8), m: e(12), l: e(18) },
    trait: e(2),
    cibleTactile: e(52),
    contenuMax: classe === 'large' ? Math.min(l, e(520)) : l,
  };
}
