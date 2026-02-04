import { z } from 'zod';

// Validação de CNPJ
export function validateCNPJ(cnpj: string): boolean {
  // Remove caracteres não numéricos
  const cleaned = cnpj.replace(/\D/g, '');
  
  if (cleaned.length !== 14) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cleaned)) return false;
  
  // Validação dos dígitos verificadores
  let sum = 0;
  let weight = 5;
  
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  
  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;
  
  if (parseInt(cleaned[12]) !== firstDigit) return false;
  
  sum = 0;
  weight = 6;
  
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  
  remainder = sum % 11;
  const secondDigit = remainder < 2 ? 0 : 11 - remainder;
  
  return parseInt(cleaned[13]) === secondDigit;
}

// Formata CNPJ para exibição
export function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, '');
  return cleaned.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

// Schema de validação para empresa
export const empresaSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
  apelido: z.string().trim().max(100, 'Apelido muito longo').optional().nullable(),
  cnpj: z.string()
    .transform(val => val.replace(/\D/g, ''))
    .refine(val => val.length === 14, 'CNPJ deve ter 14 dígitos')
    .refine(validateCNPJ, 'CNPJ inválido'),
  dia_vencimento: z.number().min(1).max(31).optional().nullable(),
  forma_envio: z.enum(['EMAIL', 'WHATSAPP', 'CORA']).default('EMAIL'),
  telefone: z.string().trim().max(20, 'Telefone muito longo').optional().nullable(),
});

export type EmpresaFormData = z.infer<typeof empresaSchema>;
