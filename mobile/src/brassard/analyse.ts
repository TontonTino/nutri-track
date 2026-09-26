// Analyse de la photo du brassard : recadre la région centrale, la réduit, lit ses pixels et en tire la couleur dominante.
// Tout se fait sur le téléphone (aucun réseau). La photo est effacée ensuite (cahier des charges : purge par défaut).
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import { type AnalyseCouleur, analyserPixels, base64VersOctets, regionCentrale } from './couleur';

const LARGEUR_ANALYSE = 48; // la région est réduite à 48 pixels de large : assez pour une couleur, très rapide

export async function analyserPhoto(uri: string, largeur: number, hauteur: number): Promise<AnalyseCouleur> {
  const contexte = ImageManipulator.manipulate(uri);
  contexte.crop(regionCentrale(largeur, hauteur)).resize({ width: LARGEUR_ANALYSE });
  const image = await contexte.renderAsync();
  const reduit = await image.saveAsync({ format: SaveFormat.JPEG, base64: true, compress: 0.9 });
  if (!reduit.base64) throw new Error("La photo n'a pas pu être analysée.");
  const pixels = decode(base64VersOctets(reduit.base64), { useTArray: true, formatAsRGBA: true });
  return analyserPixels(pixels.data, pixels.width, pixels.height);
}

// La photo d'un brassard fait partie des données de santé : elle n'est jamais conservée après usage.
export function supprimerPhoto(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    new File(uri).delete();
  } catch {
    // Fichier déjà supprimé ou inaccessible : rien à faire.
  }
}
