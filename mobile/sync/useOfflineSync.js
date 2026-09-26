/**
 * mobile/sync/useOfflineSync.js
 * Rasmata — Hook React : déclenche syncPendingDepistages() automatiquement dès
 * que le réseau revient, et expose le nombre d'éléments en attente pour affichage.
 *
 * À monter une fois, en haut de l'app (ex: App.js), pas dans chaque écran :
 *
 *   function App() {
 *     const { nombreEnAttente, enSynchronisation } = useOfflineSync();
 *     return (<NavigationContainer>...<SyncStatusBadge count={nombreEnAttente} syncing={enSynchronisation} /></NavigationContainer>);
 *   }
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { initDatabase } from './database';
import { syncPendingDepistages, getNombreEnAttente } from './syncQueue';

export function useOfflineSync() {
  const [nombreEnAttente, setNombreEnAttente] = useState(0);
  const [enSynchronisation, setEnSynchronisation] = useState(false);
  const etaitHorsLigne = useRef(false);
  const dbPrete = useRef(false);

  const rafraichirCompteur = useCallback(async () => {
    if (!dbPrete.current) return;
    setNombreEnAttente(await getNombreEnAttente());
  }, []);

  const tenterSync = useCallback(async () => {
    if (!dbPrete.current) return;
    setEnSynchronisation(true);
    try {
      await syncPendingDepistages();
    } finally {
      setEnSynchronisation(false);
      await rafraichirCompteur();
    }
  }, [rafraichirCompteur]);

  useEffect(() => {
    let annule = false;
    (async () => {
      await initDatabase();
      if (annule) return;
      dbPrete.current = true;
      await rafraichirCompteur();
      // Au démarrage de l'app, si on est déjà en ligne, on vide la file tout de suite.
      const etat = await NetInfo.fetch();
      if (etat.isConnected && etat.isInternetReachable !== false) {
        tenterSync();
      }
    })();
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((etat) => {
      const enLigneMaintenant = Boolean(etat.isConnected) && etat.isInternetReachable !== false;
      if (enLigneMaintenant && etaitHorsLigne.current) {
        // Transition hors-ligne -> en ligne détectée : on vide la file.
        tenterSync();
      }
      etaitHorsLigne.current = !enLigneMaintenant;
    });
    return () => unsubscribe();
  }, [tenterSync]);

  return {
    nombreEnAttente,
    enSynchronisation,
    // Exposé pour un bouton "réessayer maintenant" manuel si l'agent le souhaite.
    forcerSync: tenterSync,
    rafraichirCompteur,
  };
}
