/**
 * captureVisionApi.js
 * Couche API du module vision — NUTRI-DÉPIST
 *
 * Contrat : docs/CONTRAT_INTERFACE.md
 *   POST /capture-vision                      → enregistre une capture avant validation
 *   PUT  /capture-vision/{id}/validation      → enregistre la décision de l'agent
 *
 * ⚠️  MOCK actif (branche lionel/vision).
 *     Remplacer BASE_URL par l'URL réelle dès qu'Alya déploie l'API FastAPI.
 *     Les signatures de fonctions ne changent pas.
 *
 * Règle d'or (CONTRAT_INTERFACE.md §Règle d'or) :
 *   Aucune valeur estimée par la vision n'est transmise à POST /depistage
 *   sans confirmation explicite de l'agent via l'écran de confirmation.
 *   Ces fonctions sont uniquement appelées APRÈS cette confirmation.
 */

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_URL = 'https://mock.nutri-depist.local'; // TODO: remplacer par l'URL Alya
const MOCK_DELAY_MS = 600; // simule la latence réseau

// ─── Helpers ──────────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let _mockIdCounter = 1;
const nextMockId = () => `cv-mock-${Date.now()}-${_mockIdCounter++}`;

// ─── POST /capture-vision ─────────────────────────────────────────────────────

/**
 * Enregistre une capture avant validation par l'agent.
 *
 * @param {object} payload
 * @param {string}  payload.depistage_id       - ID du dépistage en cours
 * @param {'pb'|'oedeme'} payload.type_mesure  - type de mesure
 * @param {string}  payload.image_ref          - référence URI/chemin de l'image
 * @param {number}  payload.score_qualite      - 0-1, qualité de l'image
 * @param {number|null} payload.valeur_estimee - estimation en mm (null si calibration absente)
 * @param {number}  payload.score_confiance    - 0-1, confiance du calcul heuristique
 * @param {string}  payload.methode_mesure     - 'heuristique_calibration' | 'saisie_manuelle'
 *
 * @returns {Promise<{id: string}>} id de la capture créée
 */
export async function postCaptureVision(payload) {
  if (!payload.depistage_id) throw new Error('depistage_id requis');
  if (!['pb', 'oedeme'].includes(payload.type_mesure)) {
    throw new Error("type_mesure doit être 'pb' ou 'oedeme'");
  }

  // ── MOCK ──
  if (__DEV__) {
    console.log('[captureVisionApi] POST /capture-vision (mock)', payload);
    await delay(MOCK_DELAY_MS);
    return { id: nextMockId(), ...payload };
  }

  // ── PROD ──
  const response = await fetch(`${BASE_URL}/capture-vision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail ?? `POST /capture-vision échoué (${response.status})`);
  }
  return response.json();
}

// ─── PUT /capture-vision/{id}/validation ─────────────────────────────────────

/**
 * Enregistre la décision de l'agent après confirmation sur l'écran de confirmation.
 * Appelé UNIQUEMENT depuis ConfirmationScreen, jamais automatiquement.
 *
 * @param {string} captureId  - ID retourné par postCaptureVision
 * @param {object} decision
 * @param {'confirmee'|'corrigee'|'rejetee'} decision.statut
 * @param {number|null} decision.valeur_validee    - valeur retenue (en mm), null si rejetée
 * @param {string}  decision.agent_validation_id   - ID de l'agent connecté
 * @param {string}  decision.date_validation       - ISO 8601
 *
 * @returns {Promise<object>} capture mise à jour
 */
export async function putCaptureValidation(captureId, decision) {
  if (!captureId) throw new Error('captureId requis');
  if (!['confirmee', 'corrigee', 'rejetee'].includes(decision.statut)) {
    throw new Error("statut doit être 'confirmee', 'corrigee' ou 'rejetee'");
  }

  // ── MOCK ──
  if (__DEV__) {
    console.log(
      `[captureVisionApi] PUT /capture-vision/${captureId}/validation (mock)`,
      decision,
    );
    await delay(MOCK_DELAY_MS);
    return { id: captureId, ...decision };
  }

  // ── PROD ──
  const response = await fetch(`${BASE_URL}/capture-vision/${captureId}/validation`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(decision),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      err.detail ?? `PUT /capture-vision/${captureId}/validation échoué (${response.status})`,
    );
  }
  return response.json();
}

