import { describe, expect, it } from 'vitest';
import { ACTION_ECART_GROSSESSE, actionAffichee, actionParDefaut, categorieDe, ECART_GROSSESSE, libelleDe, resumeMesures } from '../services/presentation';

describe('categorieDe', () => {
  it.each([
    ['normal', 'normal'],
    ['satisfaisant', 'normal'],
    ['modéré', 'modere'],
    ['MODERE', 'modere'],
    ['ecart_suivi_rapproche', 'modere'],
    ['sévère', 'severe'],
    ['severe', 'severe'],
    ['dénutrition probable', 'severe'],
    ['inconnu', 'inconnu'],
    ['quelque chose de neuf', 'inconnu'],
  ])('%s -> %s', (brut, attendu) => {
    expect(categorieDe(brut)).toBe(attendu);
  });
});

describe('libelleDe', () => {
  it("affiche le texte exact demandé pour l'écart de grossesse", () => {
    expect(libelleDe('enceinte', 'ecart_suivi_rapproche')).toBe(
      'Écart observé par rapport à la référence — suivi rapproché recommandé',
    );
    expect(ECART_GROSSESSE).toBe('Écart observé par rapport à la référence — suivi rapproché recommandé');
  });
  it('adapte le libellé à la population', () => {
    expect(libelleDe('personne_agee', 'dénutrition probable')).toBe('Dénutrition probable — orientation nécessaire');
    expect(libelleDe('personne_agee', 'satisfaisant')).toBe('Situation normale');
    expect(libelleDe('enfant', 'sévère')).toBe('Sévère');
  });
  it('signale un résultat non reconnu au lieu de planter', () => {
    expect(libelleDe('enfant', 'zzz')).toBe('Résultat non reconnu');
  });
  it("n'affiche jamais « diagnostic confirmé »", () => {
    const populations = ['enfant', 'enceinte', 'personne_agee'] as const;
    const bruts = ['normal', 'satisfaisant', 'modéré', 'sévère', 'dénutrition probable', 'ecart_suivi_rapproche', 'inconnu'];
    for (const p of populations) {
      for (const b of bruts) {
        expect(libelleDe(p, b).toLowerCase()).not.toContain('diagnostic confirmé');
        expect(actionParDefaut(categorieDe(b), true).toLowerCase()).not.toContain('diagnostic confirmé');
        expect(actionParDefaut(categorieDe(b), false).toLowerCase()).not.toContain('diagnostic confirmé');
      }
    }
  });
});

describe('actionParDefaut', () => {
  it('oriente toujours vers un centre de santé pour un cas sévère, sans traitement à domicile', () => {
    const t = actionParDefaut('severe', false);
    expect(t).toContain('centre de santé');
    expect(t).toContain('Aucun traitement à domicile');
  });
  it("oriente aussi quand l'API a déclenché l'orientation", () => {
    expect(actionParDefaut('modere', true)).toContain('centre de santé');
  });
});

describe('resumeMesures', () => {
  it('résume chaque population', () => {
    expect(resumeMesures('enfant', { pb: 112, poids: 9.5, taille: 78 })).toBe('PB 112 mm · 9.5 kg · 78 cm');
    expect(resumeMesures('enceinte', { hauteur_uterine: 22, semaine_amenorrhee: 28, pb: 210 })).toBe('HU 22 cm · SA 28 · PB 210 mm');
    expect(resumeMesures('personne_agee', { score_mna_sf: 6, perimetre_mollet: 31 })).toBe('MNA-SF 6 · mollet 31 cm');
  });
  it('ignore les champs absents', () => {
    expect(resumeMesures('personne_agee', { score_mna_sf: 6 })).toBe('MNA-SF 6');
  });
});

describe('actionAffichee', () => {
  it("le texte du serveur prime pour les autres classifications", () => {
    expect(actionAffichee('sévère', 'Transfert immédiat', true)).toBe('Transfert immédiat');
  });
  it('un texte par défaut prend le relais si le serveur ne fournit rien', () => {
    expect(actionAffichee('normal', null, false)).toBe(actionParDefaut('normal', false));
    expect(actionAffichee('normal', '', false)).toBe(actionParDefaut('normal', false));
  });
  it("l'écart de grossesse n'affiche jamais un transfert d'urgence, même si le serveur en envoie un", () => {
    const t = actionAffichee('ecart_suivi_rapproche', 'Transfert immédiat pour prise en charge médicale', true);
    expect(t).toBe(ACTION_ECART_GROSSESSE);
    expect(t).not.toContain('Transfert');
    expect(t.toLowerCase()).not.toContain('diagnostic confirmé');
  });
});
