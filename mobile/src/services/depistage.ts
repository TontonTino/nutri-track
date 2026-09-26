// Orchestration d'un dépistage : appel API puis enregistrement dans l'historique local.
// Les écrans de saisie n'appellent que `effectuerDepistage` et `paramsResultat`.
import { AGENT_ID, CENTRE_ID } from '../constants/config';
import { ajouterDepistage, genererIdLocal } from '../data/historique';
import type { DepistageResponse, Mesures, Population } from '../types/depistage';
import { construireRequete, postDepistage } from './api';

export interface OptionsDepistage {
  personneRef?: string | null;
  oedemesIncertains?: boolean;
}

export interface ResultatEnregistre {
  reponse: DepistageResponse;
  historiqueEnregistre: boolean;
}

export async function effectuerDepistage(
  population: Population,
  mesures: Mesures,
  options: OptionsDepistage = {},
): Promise<ResultatEnregistre> {
  const dateSaisie = new Date();
  const reponse = await postDepistage(construireRequete(population, mesures));

  // Un échec de l'historique ne doit jamais masquer le résultat : le dépistage est fait, on le signale seulement.
  let historiqueEnregistre = true;
  try {
    await ajouterDepistage({
      id: genererIdLocal(AGENT_ID, CENTRE_ID, dateSaisie),
      serveur_id: reponse.id ?? null,
      population,
      personne_ref: options.personneRef?.trim() || null,
      date_saisie: dateSaisie.toISOString(),
      agent_id: AGENT_ID,
      centre_id: CENTRE_ID,
      mesures: { ...mesures },
      classification: reponse.classification,
      orientation_declenchee: reponse.orientation_declenchee,
      message: reponse.message ?? null,
      recommandation: reponse.recommandation ?? null,
      oedemes_incertains: options.oedemesIncertains === true,
      synchronise: true,
    });
  } catch (e) {
    console.warn("Historique local non enregistré", e);
    historiqueEnregistre = false;
  }
  return { reponse, historiqueEnregistre };
}

// Paramètres de navigation vers l'écran de résultat (les paramètres d'URL sont des chaînes).
export function paramsResultat(
  population: Population,
  { reponse, historiqueEnregistre }: ResultatEnregistre,
  options: OptionsDepistage = {},
): Record<string, string> {
  return {
    population,
    classification: reponse.classification,
    orientation_declenchee: String(reponse.orientation_declenchee),
    message: reponse.message ?? '',
    recommandation: reponse.recommandation ?? '',
    oedemes_incertains: options.oedemesIncertains ? '1' : '0',
    historique_ok: historiqueEnregistre ? '1' : '0',
  };
}
