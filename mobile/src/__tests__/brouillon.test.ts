import { describe, expect, it } from 'vitest';
import {
  brouillonEstVide,
  consommerBrouillonAAppliquer,
  definirBrouillonAAppliquer,
  estBrouillonValide,
  etiquetteBrouillon,
  formaterHeure,
  type Brouillon,
} from '../data/brouillonLogique';

const UN_BROUILLON: Brouillon = {
  enregistreLe: '2026-09-27T14:32:10.000Z',
  identifiant: 'Amadou',
  champs: { pb: '112', poids: '', taille: '' },
};

describe('estBrouillonValide', () => {
  it('accepte un brouillon bien formé', () => {
    expect(estBrouillonValide(UN_BROUILLON)).toBe(true);
  });

  it('rejette null, un tableau, ou une valeur non-objet', () => {
    expect(estBrouillonValide(null)).toBe(false);
    expect(estBrouillonValide([1, 2])).toBe(false);
    expect(estBrouillonValide('brouillon')).toBe(false);
  });

  it('rejette un objet auquel il manque un champ attendu', () => {
    expect(estBrouillonValide({ identifiant: 'x', champs: {} })).toBe(false);
    expect(estBrouillonValide({ enregistreLe: 'x', champs: {} })).toBe(false);
    expect(estBrouillonValide({ enregistreLe: 'x', identifiant: 'x' })).toBe(false);
  });

  it('rejette un `champs` dont une valeur n’est pas une chaîne (format étranger ou corrompu)', () => {
    expect(estBrouillonValide({ enregistreLe: 'x', identifiant: 'x', champs: { pb: 112 } })).toBe(false);
  });
});

describe('brouillonEstVide', () => {
  it('est vide quand identifiant et tous les champs sont des chaînes blanches', () => {
    expect(brouillonEstVide('', { pb: '', poids: '  ' })).toBe(true);
  });

  it("n'est pas vide dès qu'un seul champ ou l'identifiant est renseigné", () => {
    expect(brouillonEstVide('Amadou', {})).toBe(false);
    expect(brouillonEstVide('', { pb: '112' })).toBe(false);
  });
});

describe('formaterHeure', () => {
  it('formate une heure ISO en « 14h32 »', () => {
    expect(formaterHeure('2026-09-27T14:32:10.000Z')).toBe('14h32');
  });

  it('renvoie une chaîne vide pour un horodatage mal formé', () => {
    expect(formaterHeure('pas une date')).toBe('');
  });
});

describe('etiquetteBrouillon', () => {
  it('combine identifiant et heure', () => {
    expect(etiquetteBrouillon(UN_BROUILLON)).toBe('Amadou — 14h32');
  });

  it('affiche « sans nom » quand l’identifiant est vide, pour que l’agent puisse quand même décider', () => {
    expect(etiquetteBrouillon({ ...UN_BROUILLON, identifiant: '  ' })).toBe('sans nom — 14h32');
  });
});

describe('pont consentement -> formulaire (definirBrouillonAAppliquer / consommerBrouillonAAppliquer)', () => {
  it('ne renvoie la valeur posée qu’une seule fois, pour ne jamais réappliquer un brouillon après coup', () => {
    definirBrouillonAAppliquer(UN_BROUILLON);
    expect(consommerBrouillonAAppliquer()).toEqual(UN_BROUILLON);
    expect(consommerBrouillonAAppliquer()).toBeNull();
  });

  it('accepte explicitement null (choix « nouvelle saisie »)', () => {
    definirBrouillonAAppliquer(UN_BROUILLON);
    definirBrouillonAAppliquer(null);
    expect(consommerBrouillonAAppliquer()).toBeNull();
  });
});
