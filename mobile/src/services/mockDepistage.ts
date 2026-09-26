// Faux serveur POST /depistage, au même format que l'API réelle d'Alya (plages, valeurs de classification, champs).
// Les règles sont simplifiées : les vrais seuils vivent côté backend (table versionnée, §7.2).
import type {
  DepistageRequest,
  DepistageResponse,
  MesureEnfant,
  MesurePersonneAgee,
  SuiviGrossesse,
} from '../types/depistage';

type Sortie = Pick<DepistageResponse, 'classification' | 'orientation_declenchee' | 'message' | 'recommandation'>;

const ORIENTER = 'Orienter vers un centre de santé pour prise en charge.';

function classerEnfant(m: MesureEnfant): Sortie {
  // Un seul indicateur sévère suffit (pas de moyenne entre indicateurs).
  if (m.pb < 115 || m.oedemes_bilateraux === true) {
    return { classification: 'sévère', orientation_declenchee: true, message: null, recommandation: ORIENTER };
  }
  if (m.pb < 125) {
    return { classification: 'modéré', orientation_declenchee: true, message: null, recommandation: 'Orienter vers un centre de santé pour suivi.' };
  }
  return { classification: 'normal', orientation_declenchee: false, message: 'État nutritionnel normal', recommandation: null };
}

function classerGrossesse(m: SuiviGrossesse): Sortie {
  if (Math.abs(m.hauteur_uterine - m.semaine_amenorrhee) > 3) {
    return {
      classification: 'ecart_suivi_rapproche',
      orientation_declenchee: true,
      message: 'Écart observé par rapport à la référence — suivi rapproché recommandé',
      recommandation: null,
    };
  }
  if (m.pb !== undefined && m.pb < 230) {
    return {
      classification: 'modéré',
      orientation_declenchee: true,
      message: 'Périmètre brachial inférieur au seuil protocolaire (PB < 230 mm)',
      recommandation: null,
    };
  }
  return { classification: 'normal', orientation_declenchee: false, message: 'Hauteur utérine et état nutritionnel conformes', recommandation: null };
}

function classerPersonneAgee(m: MesurePersonneAgee): Sortie {
  if (m.score_mna_sf <= 7 || (m.pb_optionnel !== undefined && m.pb_optionnel < 180)) {
    return { classification: 'dénutrition probable', orientation_declenchee: true, message: null, recommandation: ORIENTER };
  }
  return { classification: 'satisfaisant', orientation_declenchee: false, message: null, recommandation: null };
}

let prochainId = 1;

export async function mockDepistage(req: DepistageRequest): Promise<DepistageResponse> {
  await new Promise((r) => setTimeout(r, 400)); // simule la latence réseau
  let sortie: Sortie;
  switch (req.population) {
    case 'enfant':
      sortie = classerEnfant(req.mesures as MesureEnfant);
      break;
    case 'enceinte':
      sortie = classerGrossesse(req.mesures as SuiviGrossesse);
      break;
    case 'personne_agee':
      sortie = classerPersonneAgee(req.mesures as MesurePersonneAgee);
      break;
  }
  return {
    id: prochainId++,
    population: req.population,
    mesures: { ...req.mesures },
    date: new Date().toISOString(),
    agent_id: req.agent_id,
    centre_id: req.centre_id,
    mode_saisie: req.mode_saisie,
    ...sortie,
  };
}
