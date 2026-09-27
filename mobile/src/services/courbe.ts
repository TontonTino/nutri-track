// Calculs de la courbe de suivi de grossesse (logique pure, testable).

// Position horizontale de chaque consultation, de 0 à 1, PROPORTIONNELLE au temps écoulé entre les dates : une
// consultation faite 2 jours après la précédente ne doit pas paraître aussi éloignée qu'une faite 2 mois après.
// Repli sur un espacement régulier si toutes les dates sont identiques.
export function fractionsTemporelles(dates: string[]): number[] {
  if (dates.length === 0) return [];
  const temps = dates.map((d) => Date.parse(`${d}T00:00:00Z`));
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  if (!(max > min)) return temps.map((_, i) => (dates.length === 1 ? 0.5 : i / (dates.length - 1)));
  return temps.map((t) => (t - min) / (max - min));
}

// Quelles dates afficher sous l'axe sans qu'elles se chevauchent. `positions` : abscisses croissantes, en pixels.
// La première et la dernière consultation sont toujours affichées quand c'est possible.
export function etiquettesVisibles(positions: number[], ecartMin: number): boolean[] {
  const n = positions.length;
  const visible = new Array<boolean>(n).fill(false);
  if (n === 0) return visible;
  visible[0] = true;
  let dernier = positions[0];
  for (let i = 1; i < n; i += 1) {
    if (positions[i] - dernier >= ecartMin) {
      visible[i] = true;
      dernier = positions[i];
    }
  }
  if (!visible[n - 1]) {
    // La dernière date prime sur l'avant-dernière étiquette si elles se gênent.
    for (let j = n - 2; j > 0; j -= 1) {
      if (visible[j]) {
        if (positions[n - 1] - positions[j] < ecartMin) visible[j] = false;
        break;
      }
    }
    visible[n - 1] = true;
  }
  return visible;
}
