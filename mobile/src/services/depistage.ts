// Orchestration d'un dépistage, en ligne comme hors ligne.
//  1. Les valeurs aberrantes sont rejetées localement (postDepistage), sans réseau.
//  2. En ligne : l'API répond (classification officielle + recommandation) et le dépistage est enregistré comme synchronisé.
//  3. Hors ligne (serveur injoignable ou trop lent) : enregistrement local par le module de synchronisation, avec une
//     classification PROVISOIRE, envoyée automatiquement au retour du réseau. L'agent n'est jamais bloqué.
// Une erreur du serveur (valeur hors plage, réponse inattendue) n'est jamais mise en file : elle est renvoyée à l'écran.
import { AGENT_ID, CENTRE_ID } from '../constants/config';
import { ajouterDepistageSynchronise, enregistrerHorsLigne, type Extras } from '../data/historique';
import type { Mesures, Population } from '../types/depistage';
import { construireRequete, postDepistage } from './api';
import { ApiError } from './apiError';

export interface OptionsDepistage {
  personneRef?: string | null;
  modeSaisie?: string; // 'manuel' par défaut, 'vision' pour un PB mesuré avec la caméra
}

export interface ResultatEnregistre {
  classification: string;
  orientation_declenchee: boolean;
  message: string | null;
  recommandation: string | null;
  provisoire: boolean; // vrai : classification locale en attente de confirmation par le serveur
  conflitAmbigu: boolean;
  historiqueEnregistre: boolean;
}

export async function effectuerDepistage(
  population: Population,
  mesures: Mesures,
  options: OptionsDepistage = {},
): Promise<ResultatEnregistre> {
  const dateSaisie = new Date().toISOString();
  const extras: Extras = {
    personne_ref: options.personneRef?.trim() || null,
    oedemes_incertains: false, // colonne conservée pour les anciens dépistages ; le formulaire n'en produit plus
    message: null,
    recommandation: null,
  };
  const requete = construireRequete(population, mesures, options.modeSaisie);

  try {
    const reponse = await postDepistage(requete);
    extras.message = reponse.message ?? null;
    extras.recommandation = reponse.recommandation ?? null;

    // Le dépistage est fait : un échec de l'historique ne doit jamais masquer le résultat, on le signale seulement.
    let historiqueEnregistre = true;
    try {
      await ajouterDepistageSynchronise({
        population,
        mesures: { ...mesures },
        agent_id: requete.agent_id,
        centre_id: requete.centre_id,
        mode_saisie: requete.mode_saisie,
        date_saisie: dateSaisie,
        serveur_id: reponse.id ?? null,
        classification: reponse.classification,
        orientation_declenchee: reponse.orientation_declenchee,
        extras,
      });
    } catch (e) {
      console.warn('Historique local non enregistré', e);
      historiqueEnregistre = false;
    }
    return {
      classification: reponse.classification,
      orientation_declenchee: reponse.orientation_declenchee,
      message: extras.message,
      recommandation: extras.recommandation,
      provisoire: false,
      conflitAmbigu: false,
      historiqueEnregistre,
    };
  } catch (e) {
    if (!(e instanceof ApiError) || e.kind !== 'hors_ligne') throw e;
  }

  // Hors ligne : si même l'enregistrement local échoue, l'erreur remonte (la donnée serait perdue en silence sinon).
  const local = await enregistrerHorsLigne({
    population,
    mesures: { ...mesures },
    agent_id: AGENT_ID,
    centre_id: CENTRE_ID,
    mode_saisie: requete.mode_saisie,
    extras,
  });
  return {
    classification: local.classification,
    orientation_declenchee: local.orientation_declenchee,
    message: null,
    recommandation: null,
    provisoire: true,
    conflitAmbigu: local.conflit_ambigu,
    historiqueEnregistre: true,
  };
}

// Paramètres de navigation vers l'écran de résultat (les paramètres d'URL sont des chaînes).
export function paramsResultat(population: Population, r: ResultatEnregistre): Record<string, string> {
  return {
    population,
    classification: r.classification,
    orientation_declenchee: String(r.orientation_declenchee),
    message: r.message ?? '',
    recommandation: r.recommandation ?? '',
    historique_ok: r.historiqueEnregistre ? '1' : '0',
    provisoire: r.provisoire ? '1' : '0',
    doublon: r.conflitAmbigu ? '1' : '0',
  };
}
