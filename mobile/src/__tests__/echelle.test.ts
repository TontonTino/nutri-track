import { describe, expect, it } from 'vitest';
import { borner, calculerEchelle } from '../theme/echelle';

describe('calculerEchelle', () => {
  it("s'adapte à la taille : un grand écran a des tailles supérieures à un petit", () => {
    const petit = calculerEchelle(320, 640);
    const moyen = calculerEchelle(390, 844);
    const tablette = calculerEchelle(768, 1024);
    expect(petit.police.corps).toBeLessThan(moyen.police.corps);
    expect(moyen.police.corps).toBeLessThan(tablette.police.corps);
    expect(petit.espace.m).toBeLessThan(tablette.espace.m);
    expect(petit.cibleTactile).toBeLessThan(tablette.cibleTactile);
  });

  it('borne le facteur pour éviter des interfaces minuscules ou démesurées', () => {
    expect(calculerEchelle(100, 200).facteur).toBe(0.85);
    expect(calculerEchelle(3000, 4000).facteur).toBe(1.5);
  });

  it('classe les écrans selon leur plus petite dimension', () => {
    expect(calculerEchelle(320, 640).classe).toBe('compact');
    expect(calculerEchelle(390, 844).classe).toBe('moyen');
    expect(calculerEchelle(768, 1024).classe).toBe('large');
  });

  it("la rotation ne fait pas exploser les tailles : l'échelle suit la dimension courte", () => {
    const portrait = calculerEchelle(390, 844);
    const paysage = calculerEchelle(844, 390);
    expect(paysage.paysage).toBe(true);
    expect(portrait.paysage).toBe(false);
    expect(paysage.police.corps).toBe(portrait.police.corps);
    expect(paysage.espace.l).toBe(portrait.espace.l);
  });

  it('le contenu occupe tout le téléphone, mais devient une colonne centrée sur grand écran', () => {
    expect(calculerEchelle(390, 844).contenuMax).toBe(390);
    const large = calculerEchelle(1280, 720);
    expect(large.contenuMax).toBeLessThan(1280);
    expect(large.contenuMax).toBeGreaterThan(400);
  });

  it('la hauteur proportionnelle suit la hauteur de la fenêtre', () => {
    expect(calculerEchelle(390, 600).ev(100)).toBeLessThan(calculerEchelle(390, 1000).ev(100));
  });

  it("ne produit jamais de valeur nulle, négative ou non finie, même avec des dimensions dégénérées", () => {
    for (const [l, h] of [[0, 0], [1, 1], [-5, 10]] as const) {
      const t = calculerEchelle(l, h);
      for (const v of [...Object.values(t.police), ...Object.values(t.espace), ...Object.values(t.rayon), t.trait, t.cibleTactile, t.contenuMax]) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThan(0);
      }
    }
  });
});

describe('borner', () => {
  it('limite une valeur à un intervalle', () => {
    expect(borner(5, 0, 10)).toBe(5);
    expect(borner(-1, 0, 10)).toBe(0);
    expect(borner(99, 0, 10)).toBe(10);
  });
});
