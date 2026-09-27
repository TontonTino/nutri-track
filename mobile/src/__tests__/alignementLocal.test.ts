import { describe, expect, it } from 'vitest';
import { alignerSurMoteur, SEUILS_MOTEUR } from '../data/alignementLocal';

const normalLocal = { classification: 'normal', orientation_declenchee: false };

describe('alignerSurMoteur : le classement provisoire hors ligne ne descend jamais sous le moteur d\'Alya', () => {
  describe('personne âgée', () => {
    it('un score MNA-SF de 7 est une dénutrition probable (Rasmata seuil à 6 : sous-classement)', () => {
      const r = alignerSurMoteur('personne_agee', { score_mna_sf: 7 }, normalLocal);
      expect(r).toEqual({ classification: 'dénutrition probable', orientation_declenchee: true });
    });
    it('le cas de référence du cahier des charges (score 6) reste une dénutrition probable', () => {
      expect(alignerSurMoteur('personne_agee', { score_mna_sf: 6 }, normalLocal).classification).toBe('dénutrition probable');
    });
    it('un PB adulte inférieur à 180 mm suffit, même avec un bon score', () => {
      expect(alignerSurMoteur('personne_agee', { score_mna_sf: 12, pb_optionnel: 170 }, normalLocal).classification).toBe('dénutrition probable');
    });
    it('un score de 8 et un PB normal restent satisfaisants, sans orientation', () => {
      expect(alignerSurMoteur('personne_agee', { score_mna_sf: 8, pb_optionnel: 250 }, normalLocal)).toEqual({
        classification: 'satisfaisant',
        orientation_declenchee: false,
      });
    });
  });

  describe('femme enceinte', () => {
    it("un écart de hauteur utérine déclenche l'orientation, comme sur le serveur", () => {
      const r = alignerSurMoteur('enceinte', { hauteur_uterine: 22, semaine_amenorrhee: 28, pb: 260 }, { classification: 'ecart_suivi_rapproche', orientation_declenchee: false });
      expect(r).toEqual({ classification: 'ecart_suivi_rapproche', orientation_declenchee: true });
    });
    it("un PB inférieur à 230 mm donne « modéré » avec orientation, même hors de la fenêtre 20-34 SA", () => {
      const r = alignerSurMoteur('enceinte', { semaine_amenorrhee: 12, pb: 215 }, { classification: 'à_confirmer_en_ligne', orientation_declenchee: false });
      expect(r).toEqual({ classification: 'modéré', orientation_declenchee: true });
    });
    it("l'écart prime sur le PB faible", () => {
      const r = alignerSurMoteur('enceinte', { pb: 200 }, { classification: 'ecart_suivi_rapproche', orientation_declenchee: true });
      expect(r.classification).toBe('ecart_suivi_rapproche');
    });
    it('hors fenêtre et sans PB faible : « à confirmer en ligne » est conservé, sans orientation inventée', () => {
      expect(alignerSurMoteur('enceinte', { semaine_amenorrhee: 12, pb: 260 }, { classification: 'à_confirmer_en_ligne', orientation_declenchee: false })).toEqual({
        classification: 'à_confirmer_en_ligne',
        orientation_declenchee: false,
      });
    });
  });

  describe('enfant', () => {
    it('un cas modéré déclenche une orientation (PECMAM), comme sur le serveur', () => {
      expect(alignerSurMoteur('enfant', { pb: 120 }, { classification: 'modéré', orientation_declenchee: false })).toEqual({
        classification: 'modéré',
        orientation_declenchee: true,
      });
    });
    it('sévère reste sévère avec orientation ; normal reste sans orientation', () => {
      expect(alignerSurMoteur('enfant', { pb: 112 }, { classification: 'sévère', orientation_declenchee: true }).orientation_declenchee).toBe(true);
      expect(alignerSurMoteur('enfant', { pb: 140 }, normalLocal).orientation_declenchee).toBe(false);
    });
  });

  it('les seuils reprennent les valeurs par défaut de la table Seuils du serveur', () => {
    expect(SEUILS_MOTEUR).toEqual({ mnaSfDenutrition: 7, pbAdulteMm: 180, pbEnceinteMm: 230 });
  });

  it('ignore des mesures non numériques sans planter', () => {
    expect(alignerSurMoteur('personne_agee', { score_mna_sf: 'x', pb_optionnel: null }, normalLocal).classification).toBe('satisfaisant');
  });
});
