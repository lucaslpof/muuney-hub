/**
 * User-friendly API error messages for Hub Edge Functions.
 * Maps HTTP status codes to Portuguese explanations.
 */
const STATUS_MESSAGES: Record<number, string> = {
  400: "Requisição inválida — tente novamente",
  401: "Sessão expirada — faça login novamente",
  403: "Acesso negado — verifique seu plano",
  404: "Dados não encontrados",
  408: "Tempo de resposta excedido — tente novamente",
  429: "Muitas requisições — aguarde alguns segundos",
  500: "Erro no servidor — tente novamente em instantes",
  502: "Serviço temporariamente indisponível",
  503: "Serviço em manutenção — tente novamente em breve",
  504: "Timeout do servidor — tente novamente",
};

/**
 * Throws a user-friendly Error based on HTTP response.
 * Use in fetch wrappers: `if (!res.ok) throwApiError(res, "Macro")`
 */
export function throwApiError(res: Response, module: string): never {
  const friendly = STATUS_MESSAGES[res.status];
  const msg = friendly
    ? `${module}: ${friendly}`
    : `${module}: Erro inesperado (${res.status})`;
  throw new Error(msg);
}
