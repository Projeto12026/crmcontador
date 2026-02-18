/**
 * Ajuste de R$ 2.800,00 nas receitas do grupo 1.
 * Aplicado SOMENTE no frontend (apresentação e cálculos derivados).
 * O backend retorna valores brutos sem esse ajuste.
 */
export const AJUSTE_RECEITAS = 2800;

/**
 * Aplica o ajuste de receitas com proteção contra valor negativo.
 */
export function aplicarAjusteReceita(valorBruto: number): number {
  return Math.max(0, valorBruto - AJUSTE_RECEITAS);
}
