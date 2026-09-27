// Lecture du brassard validée par l'agent : mémoire partagée entre l'écran de photo et le formulaire Enfant.
import { versNombre } from '../services/formulaire';
import type { ControleCouleur, ZoneBrassard } from './couleur';

export interface LectureBrassard {
  valeur_mm: number; // valeur lue par l'agent sur le brassard : c'est elle, et elle seule, qui entre dans le classement
  controle: ControleCouleur; // résultat du contrôle de la couleur photographiée (indicatif)
  couleur_detectee: ZoneBrassard | null;
}

let lecture: LectureBrassard | null = null;

export function definirLecture(l: LectureBrassard): void {
  lecture = l;
}

export function reinitialiserLecture(): void {
  lecture = null;
}

// Lue une seule fois : elle ne doit pas être réappliquée à chaque retour sur le formulaire.
export function consommerLecture(): LectureBrassard | null {
  const l = lecture;
  lecture = null;
  return l;
}

// Le contrôle photo ne vaut que pour la valeur qui a été photographiée : si l'agent retape une autre valeur, il n'y a
// plus de contrôle à mentionner.
export function lectureActive(pbTexte: string, l: LectureBrassard | null): LectureBrassard | null {
  if (!l) return null;
  const saisie = versNombre(pbTexte);
  return saisie !== null && saisie === l.valeur_mm ? l : null;
}

// Traçabilité envoyée dans `mesures` (conservée telle quelle par le serveur).
export function champsBrassard(l: LectureBrassard) {
  return { pb_controle_photo: l.controle, pb_couleur_detectee: l.couleur_detectee };
}
