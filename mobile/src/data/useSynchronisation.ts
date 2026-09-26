// État de synchronisation (mobile). Le hook de Rasmata vide la file au retour du réseau et au démarrage ; on y ajoute :
//  - la mise à jour immédiate du compteur quand un dépistage vient d'être enregistré ;
//  - une relance périodique tant que des dépistages attendent (réseau présent mais serveur injoignable : son hook
//    ne détecte alors aucun « retour du réseau »).
import { useEffect } from 'react';
import { useOfflineSync } from '../../sync';
import { INTERVALLE_RELANCE_SYNC_MS } from '../constants/config';
import { ecouterChangements } from './historique';

export interface EtatSynchro {
  nombreEnAttente: number;
  enSynchronisation: boolean;
  forcerSync: () => Promise<void>;
}

export function useSynchronisation(): EtatSynchro {
  const { nombreEnAttente, enSynchronisation, forcerSync, rafraichirCompteur } = useOfflineSync();

  useEffect(() => ecouterChangements(() => void rafraichirCompteur()), [rafraichirCompteur]);

  useEffect(() => {
    if (nombreEnAttente === 0) return;
    const minuteur = setInterval(() => {
      if (!enSynchronisation) void forcerSync();
    }, INTERVALLE_RELANCE_SYNC_MS);
    return () => clearInterval(minuteur);
  }, [nombreEnAttente, enSynchronisation, forcerSync]);

  return { nombreEnAttente, enSynchronisation, forcerSync };
}
