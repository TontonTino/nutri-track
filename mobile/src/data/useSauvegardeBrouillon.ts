// Écrit le brouillon un court instant après la dernière frappe (pas à chaque caractère) : assez réactif pour
// survivre à une interruption, sans multiplier les écritures disque pendant la saisie.
import { useEffect, useRef } from 'react';
import type { Population } from '../types/depistage';
import { enregistrerBrouillon } from './brouillon';

const DELAI_SAUVEGARDE_MS = 800;

export function useSauvegardeBrouillon(cle: Population, identifiant: string, champs: Record<string, string>): void {
  const champsJson = JSON.stringify(champs);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => {
      // Une écriture de brouillon qui échoue ne doit jamais interrompre la saisie : au pire, rien n'est
      // récupérable après une interruption, comme avant l'ajout de ce mécanisme.
      enregistrerBrouillon(cle, identifiant, JSON.parse(champsJson) as Record<string, string>).catch(() => {});
    }, DELAI_SAUVEGARDE_MS);
    return () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    };
  }, [cle, identifiant, champsJson]);
}
