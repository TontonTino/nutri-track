// Historique local des dépistages (SQLite sur mobile, mémoire sur le web).
// Interface volontairement étroite : la couche de synchronisation de Rasmata (mobile/sync/) pourra la remplacer
// ou l'étendre. `id` est l'identifiant local unique (agent + centre + horodatage local, cf. §9.3 du cahier des
// charges) qui permet de détecter les doubles saisies sans jamais écraser une mesure.
import { Platform } from 'react-native';
import type { Population } from '../types/depistage';

export interface EnregistrementHistorique {
  id: string;
  serveur_id: number | null;
  population: Population;
  personne_ref: string | null; // « Patiente » pour la grossesse, code ou nom facultatif sinon (local uniquement)
  date_saisie: string; // ISO 8601, horodatage local de la saisie
  agent_id: string;
  centre_id: string;
  mesures: Record<string, unknown>;
  classification: string;
  orientation_declenchee: boolean;
  message: string | null;
  recommandation: string | null;
  oedemes_incertains: boolean;
  synchronise: boolean; // true quand l'API a accepté le dépistage
}

export function genererIdLocal(agentId: string, centreId: string, maintenant = new Date()): string {
  const alea = Math.random().toString(36).slice(2, 8);
  return `${agentId}.${centreId}.${maintenant.getTime()}.${alea}`;
}

interface Ligne {
  id: string;
  serveur_id: number | null;
  population: string;
  personne_ref: string | null;
  date_saisie: string;
  agent_id: string;
  centre_id: string;
  mesures: string;
  classification: string;
  orientation_declenchee: number;
  message: string | null;
  recommandation: string | null;
  oedemes_incertains: number;
  synchronise: number;
}

function enEnregistrement(l: Ligne): EnregistrementHistorique {
  return {
    ...l,
    population: l.population as Population,
    mesures: JSON.parse(l.mesures) as Record<string, unknown>,
    orientation_declenchee: l.orientation_declenchee === 1,
    oedemes_incertains: l.oedemes_incertains === 1,
    synchronise: l.synchronise === 1,
  };
}

// --- Repli mémoire (web) ---
const memoire: EnregistrementHistorique[] = [];

// --- SQLite (Android / iOS) ---
type Base = import('expo-sqlite').SQLiteDatabase;
let basePromise: Promise<Base> | null = null;

function base(): Promise<Base> {
  basePromise ??= import('expo-sqlite').then(async (SQLite) => {
    const db = await SQLite.openDatabaseAsync('nutridepist.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS depistage (
        id TEXT PRIMARY KEY NOT NULL,
        serveur_id INTEGER,
        population TEXT NOT NULL,
        personne_ref TEXT,
        date_saisie TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        centre_id TEXT NOT NULL,
        mesures TEXT NOT NULL,
        classification TEXT NOT NULL,
        orientation_declenchee INTEGER NOT NULL,
        message TEXT,
        recommandation TEXT,
        oedemes_incertains INTEGER NOT NULL DEFAULT 0,
        synchronise INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_depistage_date ON depistage (date_saisie);
      CREATE INDEX IF NOT EXISTS idx_depistage_personne ON depistage (population, personne_ref);
    `);
    return db;
  });
  return basePromise;
}

const surWeb = Platform.OS === 'web';

export async function ajouterDepistage(e: EnregistrementHistorique): Promise<void> {
  if (surWeb) {
    memoire.push(e);
    return;
  }
  const db = await base();
  await db.runAsync(
    `INSERT INTO depistage (id, serveur_id, population, personne_ref, date_saisie, agent_id, centre_id, mesures,
       classification, orientation_declenchee, message, recommandation, oedemes_incertains, synchronise)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    e.id,
    e.serveur_id,
    e.population,
    e.personne_ref,
    e.date_saisie,
    e.agent_id,
    e.centre_id,
    JSON.stringify(e.mesures),
    e.classification,
    e.orientation_declenchee ? 1 : 0,
    e.message,
    e.recommandation,
    e.oedemes_incertains ? 1 : 0,
    e.synchronise ? 1 : 0,
  );
}

// Du plus récent au plus ancien.
export async function listerDepistages(): Promise<EnregistrementHistorique[]> {
  if (surWeb) return [...memoire].sort((a, b) => b.date_saisie.localeCompare(a.date_saisie));
  const db = await base();
  const lignes = await db.getAllAsync<Ligne>('SELECT * FROM depistage ORDER BY date_saisie DESC');
  return lignes.map(enEnregistrement);
}

// Suivi d'une patiente, du plus ancien au plus récent, ordonné par date de CPN.
export function suiviGrossesseDe(tous: EnregistrementHistorique[], personneRef: string): EnregistrementHistorique[] {
  return tous
    .filter((d) => d.population === 'enceinte' && d.personne_ref === personneRef)
    .sort((a, b) => dateCpn(a).localeCompare(dateCpn(b)) || a.date_saisie.localeCompare(b.date_saisie));
}

export async function listerSuiviGrossesse(personneRef: string): Promise<EnregistrementHistorique[]> {
  return suiviGrossesseDe(await listerDepistages(), personneRef);
}

export function dateCpn(e: EnregistrementHistorique): string {
  const d = e.mesures.date_cpn;
  return typeof d === 'string' && d ? d : e.date_saisie.slice(0, 10);
}
