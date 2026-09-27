// Verrou d'envoi unique (logique pure, testable) : tant qu'un envoi est en cours, tout nouvel appel est ignoré.
// Le verrou est libéré même si l'envoi échoue.
export function creerVerrou() {
  let enCours = false;
  return {
    estVerrouille: () => enCours,
    async executer(envoi: () => Promise<void>): Promise<boolean> {
      if (enCours) return false;
      enCours = true;
      try {
        await envoi();
      } finally {
        enCours = false;
      }
      return true;
    },
  };
}
