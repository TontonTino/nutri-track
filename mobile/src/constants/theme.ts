import type { Categorie } from '../services/presentation';

export const couleurs = {
  fond: '#F6F8F7',
  carte: '#FFFFFF',
  texte: '#1F2A26',
  texteSecondaire: '#66746E',
  primaire: '#1F7A4D',
  bordure: '#D9E1DD',
  ligne: '#E8EDEA',
  erreur: '#C62828',
  erreurFond: '#FDECEA',
  ombre: '#0E2A1D',
};

// Teintes de classification : un fond très doux, un accent (pastille, filet) et un texte foncé. La couleur seule ne porte
// jamais l'information : le libellé et le symbole l'accompagnent toujours (accessibilité).
export interface Teinte {
  fond: string;
  accent: string;
  texte: string;
  symbole: string;
}

export const teintes: Record<Categorie, Teinte> = {
  normal: { fond: '#EAF6EE', accent: '#2E7D32', texte: '#17472A', symbole: '✓' },
  modere: { fond: '#FFF3E2', accent: '#E08600', texte: '#6B3A00', symbole: '!' },
  severe: { fond: '#FDEDEC', accent: '#C62828', texte: '#7A1B1B', symbole: '!' },
  inconnu: { fond: '#EEF1F3', accent: '#607D8B', texte: '#2F3B42', symbole: '?' },
};
