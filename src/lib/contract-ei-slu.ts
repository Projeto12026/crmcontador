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

/**
 * Template completo do contrato EI → SLU para preview ao vivo.
 */
export const CONTRACT_TEMPLATE = `ALTERAÇÃO E TRANSFORMAÇÃO DE EMPRESÁRIO INDIVIDUAL EM SOCIEDADE LIMITADA UNIPESSOAL

{{NOME_SOCIO}}, nascido(a) em {{NASCIMENTO_SOCIO}}, portador(a) do RG nº {{RG_SOCIO}} e CPF nº {{CPF_SOCIO}}, residente e domiciliado(a) na {{ENDERECO_SOCIO}}, único(a) titular da firma individual {{FIRMA_EI}}, com sede na {{ENDERECO_EI}}, inscrita no CNPJ sob o nº {{CNPJ}}, com NIRE nº {{NIRE}}, resolve transformar a empresa individual em Sociedade Limitada Unipessoal, nos termos seguintes:

CLÁUSULA 1ª – DA TRANSFORMAÇÃO E ADMISSÃO DE SÓCIO

O(A) empresário(a) individual resolve transformar a empresa individual em Sociedade Limitada Unipessoal (SLU).

${'{'}{'{'}{'}'}{'}'} 

CLÁUSULA 2ª – DA DENOMINAÇÃO SOCIAL E SEDE

A sociedade passará a denominar-se {{RAZAO_SOCIAL_SLU}}, com sede na {{ENDERECO_SLU}}.

CLÁUSULA 3ª – DO OBJETO SOCIAL

A sociedade tem por objeto: {{OJETO_SOCIAL}}.

CLÁUSULA 4ª – DO PRAZO

A sociedade é constituída por prazo indeterminado, tendo início na data de registro deste instrumento.

CLÁUSULA 5ª – DO CAPITAL SOCIAL

O capital social é de R$ {{CAPITAL_SOCIAL}}, totalmente integralizado em moeda corrente do país.

CLÁUSULA 6ª – DA ADMINISTRAÇÃO

A sociedade será administrada pelo(a) sócio(a) {{NOME_SOCIO}}, que usará a denominação social nos atos que constituírem obrigações da sociedade.

CLÁUSULA 7ª – DO FORO

As partes elegem o foro da cidade de {{CIDADE_ASSINATURA}} para dirimir quaisquer controvérsias oriundas deste contrato.

CONSOLIDAÇÃO DO CONTRATO SOCIAL

Denominação: {{RAZAO_SOCIAL_SLU}}
CNPJ: {{CNPJ}}
NIRE: {{NIRE}}
Sede: {{ENDERECO_SLU}}
Objeto: {{OJETO_SOCIAL}}
Capital Social: R$ {{CAPITAL_SOCIAL}}
Sócio(a): {{NOME_SOCIO}}, CPF {{CPF_SOCIO}}, RG {{RG_SOCIO}}
Endereço do(a) Sócio(a): {{ENDERECO_SOCIO}}

{{CIDADE_ASSINATURA}}, {{DIA_ASSINATURA}} de {{MES_ASSINATURA}} de {{ANO_ASSINATURA}}.

_____________________________________________
{{NOME_SOCIO}}`;

/**
 * All fields flattened for the agent wizard
 */
export const ALL_FIELDS = CONTRACT_SECTIONS.flatMap(s =>
  s.fields.map(f => ({ ...f, sectionName: s.name }))
);

/**
 * Agent questions - friendly prompts for each field
 */
const AGENT_QUESTIONS: Record<string, string> = {
  NOME_SOCIO: 'Qual o **nome completo** do sócio (titular atual da EI)?',
  NASCIMENTO_SOCIO: 'Qual a **data de nascimento** do sócio? (DD/MM/AAAA)',
  RG_SOCIO: 'Qual o **RG** do sócio?',
  CPF_SOCIO: 'Qual o **CPF** do sócio? (apenas números)',
  ENDERECO_SOCIO: 'Qual o **endereço completo** do sócio? (Rua, Nº, Bairro, Cidade, Estado, CEP)',
  NOME_SOCIO_NOVO: 'Haverá um **novo sócio** sendo admitido? Se sim, qual o nome completo? (deixe vazio para pular)',
  NACIONALIDADE_SOCIO_NOVO: 'Qual a **nacionalidade** do novo sócio?',
  ESTADO_CIVIL_SOCIO_NOVO: 'Qual o **estado civil** do novo sócio?',
  REGIME_CASAMENTO_SOCIO_NOVO: 'Se casado(a), qual o **regime de casamento**? (deixe vazio se solteiro)',
  NATURALIDADE_SOCIO_NOVO: 'Qual a **naturalidade** do novo sócio? (cidade e estado)',
  DATA_NASCIMENTO_SOCIO_NOVO: 'Qual a **data de nascimento** do novo sócio?',
  RG_SOCIO_NOVO: 'Qual o **RG** do novo sócio?',
  ORGAO_EMISSOR_RG_SOCIO_NOVO: 'Qual o **órgão emissor** do RG? (ex: SSP/SP)',
  CPF_SOCIO_NOVO: 'Qual o **CPF** do novo sócio?',
  ENDERECO_SOCIO_NOVO: 'Qual o **endereço completo** do novo sócio?',
  FIRMA_EI: 'Qual o **nome da firma** da Empresa Individual (EI)?',
  ENDERECO_EI: 'Qual o **endereço** da EI?',
  NIRE: 'Qual o **NIRE** (registro na JUCESP)?',
  CNPJ: 'Qual o **CNPJ**? (apenas números)',
  RAZAO_SOCIAL_SLU: 'Qual será a **nova Razão Social** da SLU?',
  OJETO_SOCIAL: 'Descreva o **objeto social** (atividades da empresa):',
  CAPITAL_SOCIAL: 'Qual o valor do **capital social**? (ex: 10000.00)',
  ENDERECO_SLU: 'Qual o **endereço da sede** da SLU?',
  CIDADE_ASSINATURA: 'Em qual **cidade** será assinado o contrato?',
  DIA_ASSINATURA: 'Qual o **dia** da assinatura?',
  MES_ASSINATURA: 'Qual o **mês** da assinatura? (por extenso, ex: Julho)',
  ANO_ASSINATURA: 'Qual o **ano** da assinatura?',
};

export function getAgentQuestion(key: string): string {
  return AGENT_QUESTIONS[key] || `Informe o valor para **${key}**:`;
}