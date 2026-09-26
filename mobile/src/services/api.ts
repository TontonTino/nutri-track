// Seul point d'entrée réseau de l'application : les écrans n'appellent jamais fetch directement.
// Passer du mock à l'API réelle = changer USE_MOCK dans constants/config.ts.
import { AGENT_ID, API_BASE_URL, CENTRE_ID, DELAI_RESEAU_MS, USE_MOCK } from '../constants/config';
import type { DepistageRequest, DepistageResponse, Mesures, Population } from '../types/depistage';
import { ApiError } from './apiError';
import { mockDepistage } from './mockDepistage';
import { verifierPlages } from './plages';

export function construireRequete(population: Population, mesures: Mesures): DepistageRequest {
  return {
    population,
    mesures,
    agent_id: AGENT_ID,
    centre_id: CENTRE_ID,
    mode_saisie: 'manuel',
  };
}

// L'API renvoie, pour une mesure hors plage : HTTP 422 { detail: "Erreur de mesure: La mesure 'pb' (900.0) est hors de la
// plage physiologique valide [50.0, 350.0]. Nouvelle mesure demandée." }. Le nom du champ n'est pas isolé dans
// la réponse : on l'extrait du message (à remplacer par un champ dédié si Alya l'ajoute).
export function champDepuisMessage(detail: string): string | undefined {
  return /mesure '([^']+)'/.exec(detail)?.[1];
}

function nettoyer(detail: string): string {
  return detail.replace(/^Erreur de mesure:\s*/, '');
}

export async function postDepistage(req: DepistageRequest): Promise<DepistageResponse> {
  // Rejet local des valeurs aberrantes : fonctionne sans réseau et évite un aller-retour inutile.
  verifierPlages(req.population, req.mesures);
  if (USE_MOCK) return mockDepistage(req);

  // Sans délai maximal, un réseau qui « accroche » bloquerait l'agent : on abandonne et on enregistre en local.
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), DELAI_RESEAU_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/depistage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: controle.signal,
    });
  } catch {
    throw new ApiError('hors_ligne', 'Serveur injoignable.');
  } finally {
    clearTimeout(minuteur);
  }

  const corps: unknown = await res.json().catch(() => null);
  const detail = (corps as { detail?: unknown } | null)?.detail;

  if (res.status === 422 && typeof detail === 'string') {
    throw new ApiError('hors_plage', nettoyer(detail), champDepuisMessage(detail));
  }
  if (!res.ok || corps === null) {
    const message = typeof detail === 'string' ? detail : `Réponse inattendue du serveur (code ${res.status}).`;
    throw new ApiError('reseau', `${message} Vos données sont conservées.`);
  }
  return corps as DepistageResponse;
}
