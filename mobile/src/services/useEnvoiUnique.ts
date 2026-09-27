import { useCallback, useRef, useState } from 'react';
import { creerVerrou } from './verrou';

// Garantit qu'un envoi n'est lancé qu'une fois à la fois. Le verrou est une référence (modifiée immédiatement), pas un
// état : deux appuis très rapprochés sur « Valider » ne peuvent donc pas déclencher deux envois avant le nouveau rendu.
export function useEnvoiUnique() {
  const verrou = useRef(creerVerrou());
  const [chargement, setChargement] = useState(false);

  const lancer = useCallback(async (envoi: () => Promise<void>) => {
    if (verrou.current.estVerrouille()) return;
    setChargement(true);
    try {
      await verrou.current.executer(envoi);
    } finally {
      setChargement(false);
    }
  }, []);

  return { chargement, lancer };
}
