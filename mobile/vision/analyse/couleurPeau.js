/**
 * couleurPeau.js
 * Distance de couleur pure, utilisée pour détecter une rupture entre le fond et le bras.
 *
 * Volontairement séparé de mobile/src/brassard/couleur.ts (qui résout un problème voisin
 * mais différent : reconnaître une couleur de bande, pas détecter un contour) : ce module
 * doit rester autonome pour que mobile/vision/ reste consommable indépendamment de
 * l'application qui l'intègre (voir README du module).
 */

/**
 * Distance perceptuelle approximative entre deux couleurs RGB (0-255 chacune).
 * Pondération standard basse-fidélité (plus sensible au vert, comme l'œil humain) —
 * suffisante pour détecter une rupture nette, pas pour une colorimétrie précise.
 */
export function distanceCouleur(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db);
}
