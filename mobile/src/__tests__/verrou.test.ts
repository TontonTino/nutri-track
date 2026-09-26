import { describe, expect, it } from 'vitest';
import { creerVerrou } from '../services/verrou';

describe('creerVerrou', () => {
  it('ignore un second appel tant que le premier envoi est en cours (double appui sur « Valider »)', async () => {
    const verrou = creerVerrou();
    let envois = 0;
    let terminer: () => void = () => {};
    const premier = verrou.executer(
      () =>
        new Promise<void>((fin) => {
          envois += 1;
          terminer = fin;
        }),
    );
    expect(verrou.estVerrouille()).toBe(true);

    const second = await verrou.executer(async () => {
      envois += 1;
    });
    expect(second).toBe(false);

    terminer();
    expect(await premier).toBe(true);
    expect(envois).toBe(1);
  });

  it('se libère après un envoi réussi, pour permettre un nouveau dépistage', async () => {
    const verrou = creerVerrou();
    await verrou.executer(async () => {});
    expect(verrou.estVerrouille()).toBe(false);
    expect(await verrou.executer(async () => {})).toBe(true);
  });

  it("se libère aussi quand l'envoi échoue (sinon le formulaire resterait bloqué)", async () => {
    const verrou = creerVerrou();
    await expect(
      verrou.executer(async () => {
        throw new Error('échec');
      }),
    ).rejects.toThrow('échec');
    expect(verrou.estVerrouille()).toBe(false);
    expect(await verrou.executer(async () => {})).toBe(true);
  });
});
