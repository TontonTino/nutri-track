// Historique local des dépistages : adaptateur au-dessus du module de stockage / synchronisation de Rasmata
// (mobile/sync, base SQLite « nutri_depist.db », table `depistages_locaux`). Son code n'est pas modifié.
//
// Deux chemins d'écriture :
//  - en ligne : l'API a déjà répondu, on enregistre le dépistage comme SYNCHRONISÉ (aucun renvoi, donc pas de doublon) ;
//  - hors ligne : `enregistrerDepistage` de Rasmata (écriture locale d'abord, classification provisoire, envoi
//    automatique au retour du réseau).
// Les informations propres à l'application (code de la personne, œdèmes incertains, message et recommandation du
// serveur) vivent dans une table annexe `depistage_extras`, liée par `local_id`, pour ne pas toucher à son schéma.
// Sur le web, SQLite n'est pas utilisé : repli en mémoire (démonstration uniquement).
import { Platform } from 'react-native';
import type { Population } from '../types/depistage';
import { alignerSurMoteur } from './alignementLocal';

export interface EnregistrementHistorique {
  id: string; // local_id
  serveur_id: number | null;
  population: Population;
  personne_ref: string | null; // « Patiente » pour la grossesse, code ou nom facultatif sinon (local uniquement)
  date_saisie: string; // ISO 8601, horodatage local de la saisie
  agent_id: string;
  centre_id: string;
  mesures: Record<string, unknown>;
  classification: string; // celle du serveur si elle est connue, sinon la classification locale provisoire
  provisoire: boolean; // vrai tant que le serveur n'a pas confirmé la classification
  orientation_declenchee: boolean;
  message: string | null;
  recommandation: string | null;
  oedemes_incertains: boolean;
  synchronise: boolean;
  conflit_ambigu: boolean; // possible doublon signalé par le module de synchronisation
}

export interface Extras {
  personne_ref: string | null;
  oedemes_incertains: boolean;
  message: string | null;
  recommandation: string | null;
}

// Ligne de `depistages_locaux` telle que la renvoie getHistorique().
export interface LigneLocale {
  local_id: string;
  server_id: number | null;
  population: string;
  mesures: string;
  agent_id: string;
  centre_id: string;
  classification_locale: string | null;
  classification_locale_provisoire: number;
  classification_serveur: string | null;
  orientation_declenchee: number;
  date_saisie_locale: string;
  statut_sync: string;
  conflit_ambigu: number;
  conflit_avec_local_id?: string | null;
}

export function genererIdLocal(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Une ligne dont les mesures seraient illisibles ne doit jamais faire échouer tout l'historique.
function lireMesures(json: string): Record<string, unknown> {
  try {
    const m: unknown = JSON.parse(json);
    return typeof m === 'object' && m !== null && !Array.isArray(m) ? (m as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function canonique(mesuresJson: string): string {
  const m = lireMesures(mesuresJson);
  return JSON.stringify(Object.keys(m).sort().map((k) => [k, m[k]]));
}

// Le module de synchronisation signale un « doublon possible » dès que deux saisies du même agent, du même centre et de
// la même population sont proches dans le temps. C'est le cas normal d'une campagne (plusieurs enfants d'affilée) :
// on ne garde l'alerte que si les mesures sont identiques, et si les codes de personne, quand ils existent, concordent.
export function memeEvenement(a: LigneLocale, b: LigneLocale, xa?: Extras, xb?: Extras): boolean {
  if (a.population !== b.population) return false;
  if (xa?.personne_ref && xb?.personne_ref && xa.personne_ref !== xb.personne_ref) return false;
  return canonique(a.mesures) === canonique(b.mesures);
}

export function versEnregistrement(l: LigneLocale, extras?: Extras, doublonConfirme = true): EnregistrementHistorique {
  const mesures = lireMesures(l.mesures);
  const refMesures = l.population === 'enceinte' && typeof mesures.personne_id === 'string' ? mesures.personne_id : null;
  return {
    id: l.local_id,
    serveur_id: l.server_id,
    population: l.population as Population,
    personne_ref: extras?.personne_ref ?? refMesures,
    date_saisie: l.date_saisie_locale,
    agent_id: l.agent_id,
    centre_id: l.centre_id,
    mesures,
    classification: l.classification_serveur ?? l.classification_locale ?? 'inconnu',
    provisoire: l.classification_serveur === null && l.classification_locale_provisoire === 1,
    orientation_declenchee: l.orientation_declenchee === 1,
    message: extras?.message ?? null,
    recommandation: extras?.recommandation ?? null,
    oedemes_incertains: extras?.oedemes_incertains ?? false,
    synchronise: l.statut_sync === 'synchronise',
    conflit_ambigu: l.conflit_ambigu === 1 && doublonConfirme,
  };
}

// --- Notification des changements (met à jour le compteur « en attente » sans attendre une synchronisation) ---
const ecouteurs = new Set<() => void>();
export function ecouterChangements(rappel: () => void): () => void {
  ecouteurs.add(rappel);
  return () => ecouteurs.delete(rappel);
}
function signalerChangement() {
  ecouteurs.forEach((rappel) => rappel());
}

// --- Repli mémoire (web) ---
const memoire: EnregistrementHistorique[] = [];
const surWeb = Platform.OS === 'web';

// --- Accès à la base de Rasmata (chargée à la demande : jamais sur le web) ---
type ModuleSync = typeof import('../../sync');
// Le module de Rasmata est en JavaScript : on décrit ici la partie de l'API expo-sqlite que l'adaptateur utilise.
interface Base {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: unknown[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
}
let pretPromise: Promise<{ sync: ModuleSync; db: Base }> | null = null;

function pret() {
  // Une initialisation qui échoue ne doit pas rester en cache toute la session : on réessaie à l'appel suivant.
  pretPromise ??= (async () => {
    const sync = await import('../../sync');
    const db = (await sync.initDatabase()) as Base;
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS depistage_extras (
        local_id TEXT PRIMARY KEY NOT NULL,
        personne_ref TEXT,
        oedemes_incertains INTEGER NOT NULL DEFAULT 0,
        message TEXT,
        recommandation TEXT
      );
    `);
    return { sync, db };
  })().catch((e) => {
    pretPromise = null;
    throw e;
  });
  return pretPromise;
}

async function ecrireExtras(db: Base, localId: string, x: Extras) {
  await db.runAsync(
    `INSERT OR REPLACE INTO depistage_extras (local_id, personne_ref, oedemes_incertains, message, recommandation)
     VALUES (?, ?, ?, ?, ?)`,
    localId,
    x.personne_ref,
    x.oedemes_incertains ? 1 : 0,
    x.message,
    x.recommandation,
  );
}

export interface DepistageSynchronise {
  population: Population;
  mesures: Record<string, unknown>;
  agent_id: string;
  centre_id: string;
  mode_saisie: string;
  date_saisie: string;
  serveur_id: number | null;
  classification: string;
  orientation_declenchee: boolean;
  extras: Extras;
}

// Enregistre un dépistage que le serveur vient d'accepter : il est marqué « synchronisé », pas renvoyé.
export async function ajouterDepistageSynchronise(d: DepistageSynchronise): Promise<string> {
  const localId = genererIdLocal();
  if (surWeb) {
    memoire.push({
      id: localId,
      serveur_id: d.serveur_id,
      population: d.population,
      personne_ref: d.extras.personne_ref,
      date_saisie: d.date_saisie,
      agent_id: d.agent_id,
      centre_id: d.centre_id,
      mesures: d.mesures,
      classification: d.classification,
      provisoire: false,
      orientation_declenchee: d.orientation_declenchee,
      message: d.extras.message,
      recommandation: d.extras.recommandation,
      oedemes_incertains: d.extras.oedemes_incertains,
      synchronise: true,
      conflit_ambigu: false,
    });
    signalerChangement();
    return localId;
  }
  const { db } = await pret();
  await db.runAsync(
    `INSERT INTO depistages_locaux
       (local_id, server_id, population, mesures, agent_id, centre_id, mode_saisie, classification_locale,
        classification_locale_provisoire, classification_serveur, orientation_declenchee, date_saisie_locale, statut_sync)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, ?, 'synchronise')`,
    localId,
    d.serveur_id,
    d.population,
    JSON.stringify(d.mesures),
    d.agent_id,
    d.centre_id,
    d.mode_saisie,
    d.classification,
    d.orientation_declenchee ? 1 : 0,
    d.date_saisie,
  );
  await db.runAsync(
    `INSERT INTO synchronisation_log (depistage_id, date_saisie_locale, date_synchronisation) VALUES (?, ?, ?)`,
    localId,
    d.date_saisie,
    new Date().toISOString(),
  );
  await ecrireExtras(db, localId, d.extras);
  signalerChangement();
  return localId;
}

export interface DepistageHorsLigne {
  population: Population;
  mesures: Record<string, unknown>;
  agent_id: string;
  centre_id: string;
  mode_saisie: string;
  extras: Extras;
}

export interface ResultatHorsLigne {
  local_id: string;
  classification: string;
  orientation_declenchee: boolean;
  conflit_ambigu: boolean;
}

// Pas de réseau : écriture locale d'abord (module de Rasmata), classification provisoire, envoi automatique plus tard.
export async function enregistrerHorsLigne(d: DepistageHorsLigne): Promise<ResultatHorsLigne> {
  if (surWeb) {
    // Le web n'a pas de SQLite : on reproduit le comportement avec la classification locale de Rasmata (module pur).
    const { classifierHorsLigne } = await import('../../sync/localClassifier');
    const c = alignerSurMoteur(d.population, d.mesures, classifierHorsLigne(d.population, d.mesures) as { classification: string; orientation_declenchee: boolean });
    const id = genererIdLocal();
    memoire.push({
      id,
      serveur_id: null,
      population: d.population,
      personne_ref: d.extras.personne_ref,
      date_saisie: new Date().toISOString(),
      agent_id: d.agent_id,
      centre_id: d.centre_id,
      mesures: d.mesures,
      classification: c.classification,
      provisoire: true,
      orientation_declenchee: c.orientation_declenchee,
      message: null,
      recommandation: null,
      oedemes_incertains: d.extras.oedemes_incertains,
      synchronise: false,
      conflit_ambigu: false,
    });
    signalerChangement();
    return { local_id: id, classification: c.classification, orientation_declenchee: c.orientation_declenchee, conflit_ambigu: false };
  }
  const { sync, db } = await pret();
  const r = (await sync.enregistrerDepistage({
    population: d.population,
    mesures: d.mesures,
    agent_id: d.agent_id,
    centre_id: d.centre_id,
    mode_saisie: d.mode_saisie,
  })) as ResultatHorsLigne;
  // Le classifieur local de Rasmata peut sous-orienter : on relève le résultat provisoire au niveau du moteur d'Alya
  // (sans modifier son code) et on met à jour la ligne qu'elle vient d'écrire.
  const aligne = alignerSurMoteur(d.population, d.mesures, { classification: r.classification, orientation_declenchee: r.orientation_declenchee });
  if (aligne.classification !== r.classification || aligne.orientation_declenchee !== r.orientation_declenchee) {
    await db.runAsync(
      'UPDATE depistages_locaux SET classification_locale = ?, orientation_declenchee = ? WHERE local_id = ?',
      aligne.classification,
      aligne.orientation_declenchee ? 1 : 0,
      r.local_id,
    );
    r.classification = aligne.classification;
    r.orientation_declenchee = aligne.orientation_declenchee;
  }
  await ecrireExtras(db, r.local_id, d.extras);
  if (r.conflit_ambigu) {
    const lignes = (await sync.getHistorique()) as LigneLocale[];
    const moi = lignes.find((l) => l.local_id === r.local_id);
    const autre = lignes.find((l) => l.local_id === moi?.conflit_avec_local_id);
    if (moi && autre) {
      const extrasAutre = await db.getAllAsync<{ personne_ref: string | null }>(
        'SELECT personne_ref FROM depistage_extras WHERE local_id = ?',
        autre.local_id,
      );
      r.conflit_ambigu = memeEvenement(moi, autre, d.extras, { ...d.extras, personne_ref: extrasAutre[0]?.personne_ref ?? null });
    }
  }
  signalerChangement();
  return r;
}

// Du plus récent au plus ancien (consultable hors ligne).
export async function listerDepistages(): Promise<EnregistrementHistorique[]> {
  if (surWeb) return [...memoire].sort((a, b) => b.date_saisie.localeCompare(a.date_saisie));
  const { sync, db } = await pret();
  const lignes = (await sync.getHistorique()) as LigneLocale[];
  const extras = await db.getAllAsync<Extras & { local_id: string }>('SELECT * FROM depistage_extras');
  const parId = new Map(
    extras.map((x) => [x.local_id, { ...x, oedemes_incertains: Boolean(x.oedemes_incertains) } as Extras]),
  );
  const parLocalId = new Map(lignes.map((l) => [l.local_id, l]));
  return lignes.map((l) => {
    const autre = l.conflit_ambigu === 1 && l.conflit_avec_local_id ? parLocalId.get(l.conflit_avec_local_id) : undefined;
    const doublonConfirme = autre ? memeEvenement(l, autre, parId.get(l.local_id), parId.get(autre.local_id)) : true;
    return versEnregistrement(l, parId.get(l.local_id), doublonConfirme);
  });
}

// Suivi d'une patiente, du plus ancien au plus récent, ordonné par date de CPN.
export function suiviGrossesseDe(tous: EnregistrementHistorique[], personneRef: string): EnregistrementHistorique[] {
  return tous
    .filter((d) => d.population === 'enceinte' && d.personne_ref === personneRef)
    .sort((a, b) => dateCpn(a).localeCompare(dateCpn(b)) || a.date_saisie.localeCompare(b.date_saisie));
}

export function dateCpn(e: EnregistrementHistorique): string {
  const d = e.mesures.date_cpn;
  return typeof d === 'string' && d ? d : e.date_saisie.slice(0, 10);
}
