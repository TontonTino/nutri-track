import { createContext, type ReactNode, useContext } from 'react';
import { type EtatSynchro, useSynchronisation } from './useSynchronisation';

const contexte = createContext<EtatSynchro>({ nombreEnAttente: 0, enSynchronisation: false, forcerSync: async () => {} });

// À monter une seule fois, tout en haut de l'application.
export function FournisseurSynchro({ children }: { children: ReactNode }) {
  const etat = useSynchronisation();
  return <contexte.Provider value={etat}>{children}</contexte.Provider>;
}

export function useSynchro(): EtatSynchro {
  return useContext(contexte);
}
