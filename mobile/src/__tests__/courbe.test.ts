import { describe, expect, it } from 'vitest';
import { etiquettesVisibles, fractionsTemporelles } from '../services/courbe';

describe('fractionsTemporelles', () => {
  it('place les consultations proportionnellement au temps écoulé, pas à intervalles réguliers', () => {
    const f = fractionsTemporelles(['2026-06-01', '2026-06-03', '2026-08-01']);
    expect(f[0]).toBe(0);
    expect(f[2]).toBe(1);
    // 2 jours sur 61 : la 2e consultation est tout près de la 1re, pas au milieu du graphique.
    expect(f[1]).toBeCloseTo(2 / 61, 5);
  });
  it('espace régulièrement si toutes les dates sont identiques, sans diviser par zéro', () => {
    expect(fractionsTemporelles(['2026-06-01', '2026-06-01', '2026-06-01'])).toEqual([0, 0.5, 1]);
    expect(fractionsTemporelles(['2026-06-01'])).toEqual([0.5]);
    expect(fractionsTemporelles([])).toEqual([]);
  });
});

describe('etiquettesVisibles', () => {
  it('affiche toutes les dates quand la place le permet', () => {
    expect(etiquettesVisibles([0, 100, 200], 46)).toEqual([true, true, true]);
  });
  it('masque une date trop proche de la précédente', () => {
    expect(etiquettesVisibles([0, 10, 200], 46)).toEqual([true, false, true]);
  });
  it("garde la dernière date, quitte à masquer l'avant-dernière", () => {
    expect(etiquettesVisibles([0, 100, 130], 46)).toEqual([true, false, true]);
  });
  it('gère les listes vides ou réduites', () => {
    expect(etiquettesVisibles([], 46)).toEqual([]);
    expect(etiquettesVisibles([5], 46)).toEqual([true]);
  });
});
