// 'hors_plage' : l'API a rejeté une valeur (le champ fautif est indiqué).
// 'reseau'     : serveur injoignable ou réponse inattendue (le formulaire est conservé).
export type ApiErrorKind = 'hors_plage' | 'reseau';

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message: string,
    public readonly champ?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
