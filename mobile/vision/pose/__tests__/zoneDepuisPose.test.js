import { describe, expect, it } from 'vitest';
import { zoneDepuisPose, CONFIANCE_MIN_POSE } from '../zoneDepuisPose';

describe('zoneDepuisPose', () => {
  it('calcule une zone centrée sur le côté le plus confiant', () => {
    const resultat = {
      trouve: true,
      largeurImage: 400,
      hauteurImage: 300,
      gauche: { milieu: { x: 100, y: 150 }, confiance: 0.4 },
      droite: { milieu: { x: 300, y: 150 }, confiance: 0.8 }, // plus confiant
    };
    // Photo réelle 2x plus grande que l'image analysée par MoveNet.
    const zone = zoneDepuisPose(resultat, 800, 600);
    expect(zone).not.toBeNull();

    // Centre réel attendu : (300*2, 150*2) = (600, 300)
    const centreXAttendu = 600;
    const centreYAttendu = 300;
    const centreXObtenu = zone.originX + zone.width / 2;
    const centreYObtenu = zone.originY + zone.height / 2;
    expect(centreXObtenu).toBeCloseTo(centreXAttendu, 0);
    expect(centreYObtenu).toBeCloseTo(centreYAttendu, 0);
  });

  it('ignore un côté sous le seuil de confiance', () => {
    const resultat = {
      largeurImage: 400,
      hauteurImage: 300,
      gauche: { milieu: { x: 100, y: 150 }, confiance: CONFIANCE_MIN_POSE - 0.05 },
      droite: null,
    };
    expect(zoneDepuisPose(resultat, 800, 600)).toBeNull();
  });

  it('renvoie null si aucun côté n\'est détecté', () => {
    const resultat = { largeurImage: 400, hauteurImage: 300, gauche: null, droite: null };
    expect(zoneDepuisPose(resultat, 800, 600)).toBeNull();
  });

  it('renvoie null si les dimensions sont manquantes ou nulles', () => {
    const resultat = {
      largeurImage: 400,
      hauteurImage: 300,
      gauche: { milieu: { x: 100, y: 150 }, confiance: 0.9 },
      droite: null,
    };
    expect(zoneDepuisPose(null, 800, 600)).toBeNull();
    expect(zoneDepuisPose(resultat, 0, 600)).toBeNull();
    expect(zoneDepuisPose(resultat, 800, 0)).toBeNull();
  });

  it('garde la zone entièrement à l\'intérieur de l\'image, même près d\'un bord', () => {
    const resultat = {
      largeurImage: 400,
      hauteurImage: 300,
      gauche: { milieu: { x: 2, y: 2 }, confiance: 0.9 }, // tout près du coin
      droite: null,
    };
    const zone = zoneDepuisPose(resultat, 800, 600);
    expect(zone).not.toBeNull();
    expect(zone.originX).toBeGreaterThanOrEqual(0);
    expect(zone.originY).toBeGreaterThanOrEqual(0);
    expect(zone.originX + zone.width).toBeLessThanOrEqual(800);
    expect(zone.originY + zone.height).toBeLessThanOrEqual(600);
  });
});
