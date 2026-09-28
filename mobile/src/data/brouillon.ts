// Brouillon de formulaire : sauvegarde locale au fil de la saisie, pour survivre à une interruption (appel,
// appli fermée, batterie à plat en pleine saisie) — un cas normal du terrain, pas une exception (voir CommCare,
// OpenSRP). Explicitement proposé à l'agent sur l'écran de consentement (jamais restauré en silence dans le
// formulaire) : sinon la saisie interrompue d'une personne pourrait se retrouver mélangée à celle de la
// personne suivante si l'agent change de sujet entre deux dépistages.
//
// Stockage (I/O, non testé directement — voir data/brouillonLogique.ts pour la logique pure et testée).
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type { Population } from '../types/depistage';
import { type Brouillon, brouillonEstVide, estBrouillonValide } from './brouillonLogique';

export type { Brouillon } from './brouillonLogique';
export {
  brouillonEstVide,
  consommerBrouillonAAppliquer,
  definirBrouillonAAppliquer,
  estBrouillonValide,
  etiquetteBrouillon,
  formaterHeure,
} from './brouillonLogique';

function fichier(cle: Population): File {
  return new File(Paths.document, `brouillon-${cle}.json`);
}

// Le web n'est qu'un mode démo (voir data/historique.ts, même repli) : la nouvelle API fichier d'expo-file-system
// n'y est pas utilisable (pas de vrai système de fichiers dans le navigateur). Repli en mémoire, perdu au
// rechargement de la page — sans conséquence hors démo.
const surWeb = Platform.OS === 'web';
const memoire = new Map<Population, Brouillon>();

// Un problème de lecture (fichier inaccessible, etc.) ne doit jamais bloquer l'écran de consentement : sans ce
// filet, une exception ici laisserait le bouton de consentement désactivé indéfiniment (voir `pret` dans
// app/consentement.tsx), et l'agent ne pourrait plus jamais dépister cette population.
export async function lireBrouillon(cle: Population): Promise<Brouillon | null> {
  try {
    if (surWeb) return memoire.get(cle) ?? null;
    const f = fichier(cle);
    if (!f.exists) return null;
    const json: unknown = JSON.parse(await f.text());
    return estBrouillonValide(json) ? json : null;
  } catch {
    return null;
  }
}

// N'écrit rien pour un formulaire encore vide, et efface un brouillon existant si l'agent a vidé tous les
// champs (sinon un brouillon fantôme resterait proposé indéfiniment). Une écriture qui échoue ne doit jamais
// remonter jusqu'à l'appelant (voir data/useSauvegardeBrouillon.ts, qui ne doit jamais interrompre la saisie).
export async function enregistrerBrouillon(cle: Population, identifiant: string, champs: Record<string, string>): Promise<void> {
  try {
    if (brouillonEstVide(identifiant, champs)) {
      await effacerBrouillon(cle);
      return;
    }
    const brouillon: Brouillon = { enregistreLe: new Date().toISOString(), identifiant, champs };
    if (surWeb) {
      memoire.set(cle, brouillon);
      return;
    }
    fichier(cle).write(JSON.stringify(brouillon));
  } catch {
    // Au pire, cette saisie ne sera pas récupérable après une interruption — comme avant l'ajout du brouillon.
  }
}

// Appelée juste après un dépistage réussi (voir app/enfant.tsx, femme-enceinte.tsx, personne-agee.tsx) : ne doit
// jamais faire échouer cette étape. Un problème d'accès au fichier de brouillon ne doit pas transformer un envoi
// déjà accepté par le serveur en un faux échec affiché à l'agent (et un risque de double envoi s'il retente).
export async function effacerBrouillon(cle: Population): Promise<void> {
  try {
    if (surWeb) {
      memoire.delete(cle);
      return;
    }
    const f = fichier(cle);
    if (f.exists) f.delete();
  } catch {
    // Au pire, un brouillon fantôme reste sur le disque : sans conséquence, il sera proposé puis écrasé ou
    // effacé au prochain passage sur ce formulaire.
  }
}
