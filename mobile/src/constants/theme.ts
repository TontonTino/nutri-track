import type { Categorie } from '../services/presentation';

export const couleurs = {
  fond: '#F5F7F6',
  carte: '#FFFFFF',
  texte: '#1B2A24',
  texteSecondaire: '#5B6B64',
  primaire: '#1F7A4D',
  bordure: '#C9D3CE',
  erreur: '#C62828',
  erreurFond: '#FDECEA',
};

// Couleur de classification. Le texte accompagne toujours la couleur (accessibilité).
export const couleurClassification: Record<Categorie, { fond: string; texte: string }> = {
  normal: { fond: '#2E7D32', texte: '#FFFFFF' },
  modere: { fond: '#EF6C00', texte: '#FFFFFF' },
  severe: { fond: '#C62828', texte: '#FFFFFF' },
  inconnu: { fond: '#546E7A', texte: '#FFFFFF' },
};
