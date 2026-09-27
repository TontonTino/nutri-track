// Web : pas de SQLite ni de file de synchronisation (démonstration uniquement). État neutre.
export interface EtatSynchro {
  nombreEnAttente: number;
  enSynchronisation: boolean;
  forcerSync: () => Promise<void>;
}

export function useSynchronisation(): EtatSynchro {
  return { nombreEnAttente: 0, enSynchronisation: false, forcerSync: async () => {} };
}
