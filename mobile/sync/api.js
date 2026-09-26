/**
 * mobile/sync/api.js
 * Rasmata — Appel réseau vers le backend d'Alya.
 * Seul endpoint utilisé par ce module : POST /depistage (voir CONTRAT_INTERFACE.md).
 *
 * BASE_URL : à adapter selon l'environnement de démo. Idéalement injecté via
 * une variable d'environnement Expo (EXPO_PUBLIC_API_URL) pour éviter de coder
 * en dur l'IP du backend le jour du hackathon.
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

const TIMEOUT_MS = 8000;

async function fetchAvecTimeout(url, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Envoie un dépistage au backend.
 * @param {object} depistageLocal - ligne de depistages_locaux (déjà parsée)
 * @returns {Promise<object>} la réponse DepistageResponse du backend
 * @throws en cas d'échec réseau ou de statut HTTP non-2xx
 */
export async function envoyerDepistage(depistageLocal) {
  const payload = {
    population: depistageLocal.population,
    mesures: JSON.parse(depistageLocal.mesures),
    agent_id: depistageLocal.agent_id,
    centre_id: depistageLocal.centre_id,
    mode_saisie: depistageLocal.mode_saisie,
  };

  const res = await fetchAvecTimeout(`${BASE_URL}/depistage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`Échec POST /depistage (${res.status}): ${detail}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

export { BASE_URL };
