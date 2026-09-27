import { describe, expect, it } from 'vitest';
import { detecterLargeurLigne, mesurerLargeurBras } from '../largeurBras';

// ─── Fabrique d'images RGBA synthétiques ────────────────────────────────────
// Une image = fond uni + une bande centrale (le "bras") d'une autre couleur,
// avec une petite variation aléatoire pour ne pas tester sur du parfaitement
// uniforme (irréaliste, et ça masquerait un vrai bug de seuil).

const FOND = { r: 225, g: 225, b: 228 }; // mur clair
const BRAS = { r: 175, g: 130, b: 100 }; // teinte de peau

function bruite(valeur, amplitude, rng) {
  return Math.max(0, Math.min(255, Math.round(valeur + (rng() - 0.5) * amplitude)));
}

// PRNG déterministe (pas de dépendance externe, résultats reproductibles).
function rngDeterministe(graine) {
  let etat = graine;
  return () => {
    etat = (etat * 1664525 + 1013904223) % 4294967296;
    return etat / 4294967296;
  };
}

function construireLigne(largeur, gaucheBras, droiteBras, rng, amplitude = 4) {
  const ligne = new Uint8ClampedArray(largeur * 4);
  for (let x = 0; x < largeur; x += 1) {
    const estBras = x >= gaucheBras && x <= droiteBras;
    const base = estBras ? BRAS : FOND;
    const i = x * 4;
    ligne[i] = bruite(base.r, amplitude, rng);
    ligne[i + 1] = bruite(base.g, amplitude, rng);
    ligne[i + 2] = bruite(base.b, amplitude, rng);
    ligne[i + 3] = 255;
  }
  return ligne;
}

function construireImage(largeur, hauteur, gaucheBras, droiteBras, graine = 1, amplitude = 4) {
  const rng = rngDeterministe(graine);
  const rgba = new Uint8ClampedArray(largeur * hauteur * 4);
  for (let y = 0; y < hauteur; y += 1) {
    const ligne = construireLigne(largeur, gaucheBras, droiteBras, rng, amplitude);
    rgba.set(ligne, y * largeur * 4);
  }
  return rgba;
}

// ─── detecterLargeurLigne ────────────────────────────────────────────────────

describe('detecterLargeurLigne', () => {
  it('retrouve les bords du bras quand le fond est visible des deux côtés', () => {
    const largeur = 120;
    const rng = rngDeterministe(42);
    const ligne = construireLigne(largeur, 30, 89, rng);
    const r = detecterLargeurLigne(ligne, largeur, 0);
    expect(r).not.toBeNull();
    // Tolérance de quelques pixels : le bord exact dépend du bruit ajouté.
    expect(r.gauche).toBeGreaterThanOrEqual(28);
    expect(r.gauche).toBeLessThanOrEqual(32);
    expect(r.droite).toBeGreaterThanOrEqual(87);
    expect(r.droite).toBeLessThanOrEqual(91);
  });

  it("traite un bras qui remplit toute la ligne comme un cadrage correct (pas un échec)", () => {
    const largeur = 100;
    const rng = rngDeterministe(7);
    const ligne = construireLigne(largeur, 0, largeur - 1, rng); // que du "bras", pas de fond visible
    const r = detecterLargeurLigne(ligne, largeur, 0);
    expect(r).not.toBeNull();
    expect(r.gauche).toBe(0);
    expect(r.droite).toBe(largeur - 1);
  });

  it('renvoie null pour une image trop étroite pour être analysée', () => {
    const largeur = 5;
    const rng = rngDeterministe(1);
    const ligne = construireLigne(largeur, 0, largeur - 1, rng);
    expect(detecterLargeurLigne(ligne, largeur, 0)).toBeNull();
  });
});

// ─── mesurerLargeurBras ───────────────────────────────────────────────────────

describe('mesurerLargeurBras', () => {
  it('mesure une largeur cohérente quand toutes les lignes montrent le même bras', () => {
    const largeur = 120;
    const hauteur = 60;
    const rgba = construireImage(largeur, hauteur, 30, 89, 42);
    const r = mesurerLargeurBras(rgba, largeur, hauteur);
    expect(r).not.toBeNull();
    // Largeur attendue ≈ 89 - 30 = 59 px, tolérance pour le bruit.
    expect(r.largeurPx).toBeGreaterThanOrEqual(55);
    expect(r.largeurPx).toBeLessThanOrEqual(63);
    expect(r.confiance).toBeGreaterThan(0.5);
    expect(r.nLignesUtilisees).toBeGreaterThanOrEqual(3);
  });

  it('renvoie une confiance plus basse quand les lignes ne sont pas d\'accord entre elles', () => {
    const largeur = 120;
    const hauteur = 60;
    const coherente = construireImage(largeur, hauteur, 30, 89, 42);

    // Image "incohérente" : chaque ligne a un bras de largeur différente
    // (simule un bras mal cadré, en biais, ou un artefact).
    const rng = rngDeterministe(99);
    const incoherente = new Uint8ClampedArray(largeur * hauteur * 4);
    for (let y = 0; y < hauteur; y += 1) {
      const decalage = (y % 5) * 15; // largeur du "bras" très variable selon la ligne
      const ligne = construireLigne(largeur, 20, 40 + decalage, rng);
      incoherente.set(ligne, y * largeur * 4);
    }

    const rCoherente = mesurerLargeurBras(coherente, largeur, hauteur);
    const rIncoherente = mesurerLargeurBras(incoherente, largeur, hauteur);

    expect(rCoherente).not.toBeNull();
    if (rIncoherente) {
      expect(rIncoherente.confiance).toBeLessThan(rCoherente.confiance);
    }
    // Sinon (rIncoherente === null, dispersion trop grande pour être exploitable)
    // c'est aussi un résultat correct : le comportement attendu est "jamais plus
    // confiant qu'une mesure cohérente", null y compris.
  });

  it('renvoie null si l\'image est trop petite pour échantillonner assez de lignes', () => {
    const largeur = 120;
    const hauteur = 3; // moins que le nombre de lignes par défaut (5)
    const rgba = construireImage(largeur, hauteur, 30, 89, 42);
    expect(mesurerLargeurBras(rgba, largeur, hauteur)).toBeNull();
  });

  it('plafonne toujours la confiance à 0.85 (reste une heuristique, jamais une certitude)', () => {
    const largeur = 200;
    const hauteur = 80;
    // Contraste très fort, lignes parfaitement identiques : le meilleur cas possible.
    const rgba = construireImage(largeur, hauteur, 50, 149, 1, 0);
    const r = mesurerLargeurBras(rgba, largeur, hauteur);
    expect(r).not.toBeNull();
    expect(r.confiance).toBeLessThanOrEqual(0.85);
  });
});
