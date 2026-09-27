import { describe, expect, it } from 'vitest';
import {
  analyserPixels,
  base64VersOctets,
  controleCouleur,
  regionCentrale,
  rgbVersHsv,
  zoneDepuisPb,
  zoneDuPixel,
} from '../brassard/couleur';

// Image synthétique : `n` pixels de la couleur donnée.
function pixels(...blocs: [number, [number, number, number]][]): { data: number[]; largeur: number; hauteur: number } {
  const data: number[] = [];
  for (const [n, [r, g, b]] of blocs) for (let i = 0; i < n; i += 1) data.push(r, g, b, 255);
  const total = data.length / 4;
  return { data, largeur: total, hauteur: 1 };
}

const ROUGE: [number, number, number] = [200, 30, 30];
const JAUNE: [number, number, number] = [240, 200, 20];
const VERT: [number, number, number] = [40, 160, 60];
const GRIS: [number, number, number] = [120, 120, 120];
const BLANC: [number, number, number] = [240, 240, 240];
const PEAU_CLAIRE: [number, number, number] = [225, 172, 145];

describe('zoneDepuisPb (zones du brassard)', () => {
  it('rouge sous 115 mm, jaune de 115 à 124 mm, vert dès 125 mm', () => {
    expect(zoneDepuisPb(112)).toBe('rouge');
    expect(zoneDepuisPb(114.9)).toBe('rouge');
    expect(zoneDepuisPb(115)).toBe('jaune');
    expect(zoneDepuisPb(124.9)).toBe('jaune');
    expect(zoneDepuisPb(125)).toBe('vert');
    expect(zoneDepuisPb(180)).toBe('vert');
  });
});

describe('rgbVersHsv', () => {
  it('convertit les couleurs primaires', () => {
    expect(rgbVersHsv(255, 0, 0).h).toBe(0);
    expect(rgbVersHsv(0, 255, 0).h).toBe(120);
    expect(rgbVersHsv(0, 0, 255).h).toBe(240);
    expect(rgbVersHsv(128, 128, 128).s).toBe(0);
    expect(rgbVersHsv(0, 0, 0).v).toBe(0);
  });
});

describe('zoneDuPixel', () => {
  it('reconnaît les trois bandes du brassard', () => {
    expect(zoneDuPixel(...ROUGE)).toBe('rouge');
    expect(zoneDuPixel(...JAUNE)).toBe('jaune');
    expect(zoneDuPixel(...VERT)).toBe('vert');
  });
  it('ignore les gris, le blanc, le noir et une peau claire (pas assez saturés)', () => {
    for (const c of [GRIS, BLANC, PEAU_CLAIRE, [10, 10, 10] as [number, number, number]]) expect(zoneDuPixel(...c)).toBeNull();
  });
  it('ignore le bleu', () => {
    expect(zoneDuPixel(20, 40, 220)).toBeNull();
  });
});

describe('analyserPixels', () => {
  it('détecte la couleur dominante de la bande', () => {
    const img = pixels([300, ROUGE], [50, GRIS], [10, VERT]);
    const r = analyserPixels(img.data, img.largeur, img.hauteur);
    expect(r.detectee).toBe('rouge');
    expect(r.parts.rouge).toBe(300);
  });
  it('ne détecte rien quand la région est presque sans couleur (bande absente)', () => {
    const img = pixels([950, GRIS], [50, ROUGE]);
    expect(analyserPixels(img.data, img.largeur, img.hauteur).detectee).toBeNull();
  });
  it("ne devine pas quand plusieurs couleurs se mêlent sans dominante nette", () => {
    const img = pixels([200, ROUGE], [200, VERT], [200, JAUNE]);
    expect(analyserPixels(img.data, img.largeur, img.hauteur).detectee).toBeNull();
  });
  it("ne détecte rien sur une image vide ou entièrement blanche", () => {
    expect(analyserPixels([], 0, 0).detectee).toBeNull();
    const img = pixels([400, BLANC]);
    expect(analyserPixels(img.data, img.largeur, img.hauteur).detectee).toBeNull();
  });
});

describe('controleCouleur', () => {
  it('cohérent quand la couleur photographiée correspond à la zone de la valeur saisie', () => {
    expect(controleCouleur(112, 'rouge')).toBe('coherent');
    expect(controleCouleur(120, 'jaune')).toBe('coherent');
    expect(controleCouleur(140, 'vert')).toBe('coherent');
  });
  it("incohérent quand la valeur saisie et la bande photographiée diffèrent (erreur de lecture ou de frappe)", () => {
    expect(controleCouleur(130, 'rouge')).toBe('incoherent');
    expect(controleCouleur(112, 'vert')).toBe('incoherent');
  });
  it('non détecté : ni alarme ni validation', () => {
    expect(controleCouleur(130, null)).toBe('non_detecte');
  });
});

describe('regionCentrale', () => {
  it('centre la région et reste dans la photo', () => {
    const r = regionCentrale(4000, 3000);
    expect(r).toEqual({ originX: 1200, originY: 1200, width: 1600, height: 600 });
    expect(r.originX + r.width).toBeLessThanOrEqual(4000);
    expect(r.originY + r.height).toBeLessThanOrEqual(3000);
  });
  it('gère une très petite image', () => {
    const r = regionCentrale(1, 1);
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
  });
});

describe('base64VersOctets', () => {
  it('décode comme Buffer, avec ou sans remplissage', () => {
    for (const texte of ['', 'a', 'ab', 'abc', 'abcd', 'NUTRI-DÉPIST 112 mm']) {
      const attendu = Buffer.from(texte, 'utf8');
      const decode = base64VersOctets(attendu.toString('base64'));
      expect(Buffer.from(decode).equals(attendu)).toBe(true);
    }
  });
  it('ignore les sauts de ligne éventuels', () => {
    const attendu = Buffer.from('bonjour tout le monde', 'utf8');
    const b64 = attendu.toString('base64');
    const avecSauts = `${b64.slice(0, 8)}\n${b64.slice(8)}`;
    expect(Buffer.from(base64VersOctets(avecSauts)).equals(attendu)).toBe(true);
  });
});
