/**
 * Resultado padronizado das leituras de dados.
 *
 * - `error: null` + dados vazios  → estado vazio (nada cadastrado ainda)
 * - `unavailable: true`           → recurso ainda não existe no backend (tabela/coluna ausente);
 *                                   a UI trata como estado vazio, não como erro
 * - `error: string`               → falha real; a UI exibe estado de erro com "tentar novamente"
 */
export type QueryResult<T> = {
  data: T
  error: string | null
  unavailable?: boolean
}

type SupabaseLikeError = { code?: string; message?: string } | null

/** Códigos do PostgREST/Postgres para "recurso inexistente". */
const MISSING_RESOURCE_CODES = new Set(["42P01", "PGRST205", "42703", "PGRST204"])

export function isMissingResource(error: SupabaseLikeError): boolean {
  return Boolean(error?.code && MISSING_RESOURCE_CODES.has(error.code))
}

export function toResult<Row, T>(
  response: { data: Row | null; error: SupabaseLikeError },
  map: (row: Row) => T,
  fallback: T,
  errorMessage: string,
): QueryResult<T> {
  if (response.error) {
    if (isMissingResource(response.error)) return { data: fallback, error: null, unavailable: true }
    console.error("[data]", errorMessage, response.error)
    return { data: fallback, error: errorMessage }
  }
  if (response.data == null) return { data: fallback, error: null }
  return { data: map(response.data), error: null }
}

export function ok<T>(data: T): QueryResult<T> {
  return { data, error: null }
}
