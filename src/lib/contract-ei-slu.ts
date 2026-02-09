/**
 * Configuração e lógica do Gerador de Contrato EI → SLU
 */

export interface ContractField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'textarea';
  required: boolean;
  hint: string;
}

export interface ContractSection {
  id: string;
  name: string;
  fields: ContractField[];
}

export const CONTRACT_SECTIONS: ContractSection[] = [
  {
    id: 'socio_original',
    name: 'Dados do Sócio (atual/titular EI)',
    fields: [
      { key: 'NOME_SOCIO', label: 'Nome do Sócio', type: 'text', required: true, hint: 'Nome completo do sócio' },
      { key: 'NASCIMENTO_SOCIO', label: 'Data de Nascimento do Sócio', type: 'date', required: true, hint: 'DD/MM/AAAA' },
      { key: 'RG_SOCIO', label: 'RG do Sócio', type: 'text', required: true, hint: 'Número do RG' },
      { key: 'CPF_SOCIO', label: 'CPF do Sócio', type: 'text', required: true, hint: 'CPF (apenas números)' },
      { key: 'ENDERECO_SOCIO', label: 'Endereço do Sócio', type: 'textarea', required: true, hint: 'Rua, Número, Bairro, Cidade, Estado, CEP' },
    ],
  },
  {
    id: 'socio_novo',
    name: 'Dados do Novo Sócio (admissão na sociedade)',
    fields: [
      { key: 'NOME_SOCIO_NOVO', label: 'Nome do Novo Sócio', type: 'text', required: false, hint: 'Nome completo' },
      { key: 'NACIONALIDADE_SOCIO_NOVO', label: 'Nacionalidade', type: 'text', required: false, hint: 'Ex: brasileira' },
      { key: 'ESTADO_CIVIL_SOCIO_NOVO', label: 'Estado Civil', type: 'text', required: false, hint: 'Ex: solteiro(a), casado(a)' },
      { key: 'REGIME_CASAMENTO_SOCIO_NOVO', label: 'Regime de Casamento (se casado)', type: 'text', required: false, hint: 'Ex: comunhão universal de bens' },
      { key: 'NATURALIDADE_SOCIO_NOVO', label: 'Naturalidade', type: 'text', required: false, hint: 'Ex: cidade de São Paulo, SP' },
      { key: 'DATA_NASCIMENTO_SOCIO_NOVO', label: 'Data de Nascimento', type: 'date', required: false, hint: 'DD/MM/AAAA' },
      { key: 'RG_SOCIO_NOVO', label: 'RG', type: 'text', required: false, hint: 'Número do RG' },
      { key: 'ORGAO_EMISSOR_RG_SOCIO_NOVO', label: 'Órgão Emissor do RG', type: 'text', required: false, hint: 'Ex: SSP/SP' },
      { key: 'CPF_SOCIO_NOVO', label: 'CPF', type: 'text', required: false, hint: 'CPF (apenas números)' },
      { key: 'ENDERECO_SOCIO_NOVO', label: 'Endereço', type: 'textarea', required: false, hint: 'Endereço completo' },
    ],
  },
  {
    id: 'empresa_individual',
    name: 'Dados da Empresa Individual (EI)',
    fields: [
      { key: 'FIRMA_EI', label: 'Firma da EI', type: 'text', required: true, hint: 'Nome da Empresa Individual' },
      { key: 'ENDERECO_EI', label: 'Endereço da EI', type: 'textarea', required: true, hint: 'Endereço completo da EI' },
    ],
  },
  {
    id: 'registro',
    name: 'Dados de Registro',
    fields: [
      { key: 'NIRE', label: 'NIRE', type: 'text', required: true, hint: 'Número de Identificação do Registro de Empresas (JUCESP)' },
      { key: 'CNPJ', label: 'CNPJ', type: 'text', required: true, hint: 'CNPJ (apenas números)' },
    ],
  },
  {
    id: 'slu',
    name: 'Dados da Sociedade Limitada Unipessoal (SLU)',
    fields: [
      { key: 'RAZAO_SOCIAL_SLU', label: 'Razão Social SLU', type: 'text', required: true, hint: 'Nova Razão Social da SLU' },
      { key: 'OJETO_SOCIAL', label: 'Objeto Social', type: 'textarea', required: true, hint: 'Descrição das atividades da empresa' },
      { key: 'CAPITAL_SOCIAL', label: 'Capital Social', type: 'text', required: true, hint: 'Valor (ex: 10000.00)' },
      { key: 'ENDERECO_SLU', label: 'Endereço da SLU', type: 'textarea', required: true, hint: 'Endereço completo da sede' },
    ],
  },
  {
    id: 'assinatura',
    name: 'Dados da Assinatura',
    fields: [
      { key: 'CIDADE_ASSINATURA', label: 'Cidade da Assinatura', type: 'text', required: true, hint: 'Cidade onde o contrato será assinado' },
      { key: 'DIA_ASSINATURA', label: 'Dia', type: 'text', required: true, hint: 'Ex: 06' },
      { key: 'MES_ASSINATURA', label: 'Mês', type: 'text', required: true, hint: 'Ex: Julho' },
      { key: 'ANO_ASSINATURA', label: 'Ano', type: 'text', required: true, hint: 'Ex: 2025' },
    ],
  },
];

export const ALL_KEYS = CONTRACT_SECTIONS.flatMap(s => s.fields.map(f => f.key));

export type ContractFormValues = Record<string, string>;

/**
 * Build a replacement map from form values.
 * Supports both {{KEY}} and [KEY] placeholder formats.
 */
export function buildReplacementMap(values: ContractFormValues): Record<string, string> {
  const map: Record<string, string> = {};
  ALL_KEYS.forEach(key => {
    const value = values[key] ?? '';
    map[`{{${key}}}`] = value;
    map[`[${key}]`] = value;
  });
  return map;
}

/**
 * Replace all placeholders in a text string with form values.
 */
export function replacePlaceholders(text: string, values: ContractFormValues): string {
  let result = text;
  const map = buildReplacementMap(values);
  for (const [placeholder, value] of Object.entries(map)) {
    result = result.split(placeholder).join(value);
  }
  return result;
}

/**
 * Validate required fields. Returns array of missing field labels.
 */
export function validateRequired(values: ContractFormValues): string[] {
  const missing: string[] = [];
  CONTRACT_SECTIONS.forEach(section => {
    section.fields.forEach(field => {
      if (field.required && !values[field.key]?.trim()) {
        missing.push(field.label);
      }
    });
  });
  return missing;
}

/**
 * Cláusula 1 – Texto do novo sócio
 */
export const CLAUSULA_1_NOVO_SOCIO =
  'Entra na sociedade, {{NOME_SOCIO_NOVO}}, nacionalidade: {{NACIONALIDADE_SOCIO_NOVO}}, {{ESTADO_CIVIL_SOCIO_NOVO}}{{REGIME_CASAMENTO_SOCIO_NOVO}}, natural da cidade de {{NATURALIDADE_SOCIO_NOVO}}, nascido(a) em: {{DATA_NASCIMENTO_SOCIO_NOVO}}, n° do documento de identidade: {{RG_SOCIO_NOVO}} órgão emissor: {{ORGAO_EMISSOR_RG_SOCIO_NOVO}}, CPF: {{CPF_SOCIO_NOVO}}, residente e domiciliado na {{ENDERECO_SOCIO_NOVO}}.';
