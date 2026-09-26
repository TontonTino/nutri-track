// Contrat de données NUTRI-DÉPIST, aligné sur l'API d'Alya (branche alya/engine-api)
// et docs/CONTRAT_INTERFACE.md. Les noms de champs sont partagés avec l'équipe : ne pas les renommer.

// Valeur attendue par l'API : "enceinte" (et non "femme_enceinte").
export type Population = 'enfant' | 'enceinte' | 'personne_agee';

// --- Formulaire (ce que voit l'ASC) ---

// L'ASC répond Oui / Non / Incertain. L'API, elle, attend un booléen (voir services/mappings.ts).
export type Oedemes = 'Oui' | 'Non' | 'Incertain';

// --- Mesures envoyées à l'API (POST /depistage, champ `mesures`) ---

// Unités : pb en mm, poids en kg, taille en cm.
export interface MesureEnfant {
  pb: number;
  pb_source: string; // "manuel" ; "camera" quand le module de Lionel sera branché
  poids: number;
  taille: number;
  oedemes_bilateraux: boolean;
  oedemes_source: string; // "clinique" par défaut
}

// Unités : hauteur_uterine en cm, pb en mm.
export interface SuiviGrossesse {
  personne_id: string;
  date_cpn?: string; // ISO 8601, optionnel côté API
  hauteur_uterine: number;
  hauteur_uterine_source: string; // "mètre_ruban" par défaut
  pb?: number;
  semaine_amenorrhee: number; // entier
}

// Unités : perimetre_mollet en cm, pb_optionnel en mm, score_mna_sf de 0 à 14 (entier).
export interface MesurePersonneAgee {
  perimetre_mollet?: number;
  pb_optionnel?: number;
  perte_poids_recente?: boolean;
  score_mna_sf: number;
}

export type Mesures = MesureEnfant | SuiviGrossesse | MesurePersonneAgee;

export interface DepistageRequest {
  population: Population;
  mesures: Mesures;
  agent_id: string;
  centre_id: string;
  mode_saisie: string; // "manuel"
}

// Réponse de POST /depistage (HTTP 201). La date est fixée par le serveur.
// `classification` est une chaîne libre côté serveur : "normal", "modéré", "sévère",
// "dénutrition probable", "satisfaisant", "ecart_suivi_rapproche"… (voir services/presentation.ts).
export interface DepistageResponse {
  id: number;
  population: string;
  mesures: Record<string, unknown>;
  date: string;
  agent_id: string;
  centre_id: string;
  classification: string;
  orientation_declenchee: boolean;
  mode_saisie: string;
  message?: string | null;
  recommandation?: string | null;
}
