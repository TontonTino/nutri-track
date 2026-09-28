import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { Categorie } from '../services/presentation';

type NomIcone = ComponentProps<typeof Ionicons>['name'];

// Palette « soin » alignée sur le logo NUTRI-DÉPIST — vert feuille (personne, croissance) et orange grain (récolte,
// nutrition) —, fond très clair, cartes blanches, ombres teintées plutôt que grises. Objectif : moderne et épuré,
// jamais criard. La couleur ne porte jamais seule l'information (toujours accompagnée d'un symbole et d'un texte)
// — voir teintes ci-dessous et les composants qui les consomment.
export const couleurs = {
  fond: '#F2FAF3',
  fondDegrade: ['#E6F6E9', '#FBFDF6'] as const,
  carte: '#FFFFFF',
  texte: '#17301C',
  texteSecondaire: '#69806E',
  primaire: '#2F9E44',
  primaireFonce: '#1E7A34',
  primaireDegrade: ['#3DB054', '#1E7A34'] as const,
  primaireDoux: '#E6F6E9',
  accent: '#F2A626',
  accentFonce: '#C97C0B',
  accentDoux: '#FFF1DC',
  bordure: '#DCEEDF',
  ligne: '#EAF6EC',
  erreur: '#D64550',
  erreurFond: '#FCEAEB',
  ombre: '#0B2A12',
};

// Teintes de classification : un fond très doux, un accent (pastille, filet) et un texte foncé. La couleur seule ne porte
// jamais l'information : le libellé et l'icône l'accompagnent toujours (accessibilité). « Modéré » reprend l'orange du
// logo (grain de blé), « sévère » reste rouge (danger, jamais réinterprété).
export interface Teinte {
  fond: string;
  accent: string;
  texte: string;
  icone: NomIcone;
}

export const teintes: Record<Categorie, Teinte> = {
  normal: { fond: '#E6F6E9', accent: '#2F9E44', texte: '#134F22', icone: 'checkmark-circle' },
  modere: { fond: '#FFF1DC', accent: '#F2A626', texte: '#7A4B00', icone: 'alert-circle' },
  severe: { fond: '#FBEAEA', accent: '#D64550', texte: '#7A1F24', icone: 'warning' },
  inconnu: { fond: '#EEF2F3', accent: '#7C93A6', texte: '#33454F', icone: 'help-circle' },
};
