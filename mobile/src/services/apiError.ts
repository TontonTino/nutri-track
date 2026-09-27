// 'hors_plage' : l'API a rejeté une valeur (le champ fautif est indiqué).
// 'hors_ligne' : serveur injoignable ou trop lent (pas de réseau) : le dépistage est enregistré en local.
// 'reseau'     : le serveur a répondu par une erreur inattendue (le formulaire est conservé).
export type ApiErrorKind = 'hors_plage' | 'hors_ligne' | 'reseau';

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
