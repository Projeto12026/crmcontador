/**
 * Configuração e lógica do Gerador de Contrato EI → SLU
 */

export interface ContractField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'textarea' | 'yesno';
  required: boolean;
  hint: string;
  /** If this field is a yes/no gate, which section of fields to conditionally show */
  conditionalSection?: string;
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
      { key: 'CAPITAL_SOCIAL', label: 'Capital Social', type: 'text', required: true, hint: 'Valor (ex: 10.000,00)' },
      { key: 'ENDERECO_SLU', label: 'Endereço da SLU', type: 'textarea', required: true, hint: 'Endereço completo da sede' },
    ],
  },
  {
    id: 'alteracoes',
    name: 'Alterações Adicionais',
    fields: [
      { key: 'ALTERA_ENDERECO', label: 'Haverá alteração de endereço?', type: 'yesno', required: true, hint: 'Sim ou Não', conditionalSection: 'endereco_novo' },
      { key: 'NOVO_ENDERECO', label: 'Novo Endereço', type: 'textarea', required: false, hint: 'Endereço completo do novo logradouro' },
      { key: 'ALTERA_CAPITAL', label: 'Haverá alteração de capital social?', type: 'yesno', required: true, hint: 'Sim ou Não', conditionalSection: 'capital_novo' },
      { key: 'NOVO_CAPITAL', label: 'Novo Capital Social', type: 'text', required: false, hint: 'Valor (ex: 50.000,00)' },
    ],
  },
  {
    id: 'foro',
    name: 'Foro',
    fields: [
      { key: 'FORO_COMARCA', label: 'Comarca do Foro', type: 'text', required: true, hint: 'Ex: Guarulhos' },
      { key: 'FORO_ESTADO', label: 'Estado do Foro', type: 'text', required: true, hint: 'Ex: SP' },
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
        // Skip conditional fields that don't apply
        if (field.key === 'NOVO_ENDERECO' && values['ALTERA_ENDERECO']?.toLowerCase() !== 'sim') return;
        if (field.key === 'NOVO_CAPITAL' && values['ALTERA_CAPITAL']?.toLowerCase() !== 'sim') return;
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
 * Generate the full contract text dynamically based on conditional clauses.
 * This handles automatic clause renumbering.
 */
export function generateContractText(values: ContractFormValues): string {
  const v = (key: string) => values[key] || `{{${key}}}`;
  
  const hasNovoSocio = !!values['NOME_SOCIO_NOVO']?.trim();
  const alteraEndereco = values['ALTERA_ENDERECO']?.toLowerCase() === 'sim';
  const alteraCapital = values['ALTERA_CAPITAL']?.toLowerCase() === 'sim';
  
  const foroComarca = values['FORO_COMARCA'] || 'Guarulhos';
  const foroEstado = values['FORO_ESTADO'] || 'SP';

  // Build transformation clauses with dynamic numbering
  const transformationClauses: string[] = [];
  let clauseNum = 1;

  // Cláusula: Novo sócio (conditional)
  if (hasNovoSocio) {
    const regimeText = values['REGIME_CASAMENTO_SOCIO_NOVO']
      ? `, sob o regime de ${v('REGIME_CASAMENTO_SOCIO_NOVO')}`
      : '';
    transformationClauses.push(
      `Cláusula ${clauseNum}ª.\n\nEntra na sociedade, ${v('NOME_SOCIO_NOVO')}, nacionalidade: ${v('NACIONALIDADE_SOCIO_NOVO')}, ${v('ESTADO_CIVIL_SOCIO_NOVO')}${regimeText}, natural da cidade de ${v('NATURALIDADE_SOCIO_NOVO')}, nascido(a) em: ${v('DATA_NASCIMENTO_SOCIO_NOVO')}, n° do documento de identidade: ${v('RG_SOCIO_NOVO')} órgão emissor: ${v('ORGAO_EMISSOR_RG_SOCIO_NOVO')}, CPF: ${v('CPF_SOCIO_NOVO')}, residente e domiciliado na ${v('ENDERECO_SOCIO_NOVO')}.`
    );
    clauseNum++;
  }

  // Cláusula: Razão Social
  transformationClauses.push(
    `Cláusula ${clauseNum}ª.\n\nFica alterada a Razão Social para ${v('RAZAO_SOCIAL_SLU')}.`
  );
  clauseNum++;

  // Cláusula: Objeto Social
  transformationClauses.push(
    `Cláusula ${clauseNum}ª.\n\nO objeto passará a ser: ${v('OJETO_SOCIAL')}.`
  );
  clauseNum++;

  // Cláusula: Alteração de endereço (conditional)
  if (alteraEndereco) {
    transformationClauses.push(
      `Cláusula ${clauseNum}ª.\n\nO endereço passa a ser no logradouro: ${v('NOVO_ENDERECO')}.`
    );
    clauseNum++;
  }

  // Cláusula: Alteração de capital (conditional)
  if (alteraCapital) {
    transformationClauses.push(
      `Cláusula ${clauseNum}ª.\n\nO capital passará a ser ${v('NOVO_CAPITAL')} totalmente integrado em moeda nacional.`
    );
    clauseNum++;
  }

  // Cláusula: Consolidação
  transformationClauses.push(
    `Cláusula ${clauseNum}ª DA CONSOLIDAÇÃO DO INSTRUMENTO:\n\nTendo em vista as modificações ora ajustadas, consolida-se o Instrumento Constitutivo, tornando sem efeito, a partir desta data, as cláusulas e condições contidas no contrato primitivo e alterações anteriores, passando a ter a seguinte redação.`
  );

  // Use the appropriate address for the SLU (if changed, use new address)
  const enderecoSede = alteraEndereco && values['NOVO_ENDERECO']?.trim()
    ? v('NOVO_ENDERECO')
    : v('ENDERECO_SLU');

  // Use the appropriate capital (if changed, use new capital)
  const capitalFinal = alteraCapital && values['NOVO_CAPITAL']?.trim()
    ? v('NOVO_CAPITAL')
    : v('CAPITAL_SOCIAL');

  const consolidationClauses = [
    `Cláusula 1ª.\n\nA sociedade unipessoal gira sob o nome empresarial de ${v('RAZAO_SOCIAL_SLU')}`,
    `Cláusula 2ª.\n\nO endereço da sede: ${enderecoSede}.`,
    `Cláusula 3ª.\n\nO objeto social: ${v('OJETO_SOCIAL')}`,
    `Cláusula 4ª.\n\nO prazo de duração da sociedade será por tempo indeterminado.`,
    `Cláusula 5ª\n\nO capital é de ${capitalFinal} totalmente subscrito e já integralizado, em moeda corrente do País.`,
    `Cláusula 6ª.\n\nA responsabilidade do sócio único é restrita ao valor de suas quotas, desde que inteiramente integralizado a totalidade do capital social, nos termos do art. 1.052 da Lei n.º 10.460/2002 (Código Civil).`,
    `Cláusula 7ª.\n\nA administração da sociedade será exercida pelo sócio ${v('NOME_SOCIO')}, com os poderes e atribuições de administrador, isoladamente, que terá a representação ativa ou passiva da Sociedade, judicial e extrajudicialmente, podendo praticar todos os atos compreendidos no objeto social, sempre no interesse da Sociedade.`,
    `Cláusula 8ª.\n\nO administrador declara, sob as penas da lei, de que não está impedida de exercer a administração da sociedade, por lei especial, ou em virtude de condenação criminal, ou por se encontrar sob os efeitos dela, a pena que vede, ainda que temporariamente, o acesso a cargos públicos; ou por crime falimentar, de prevaricação, peita ou suborno, concussão, peculato, ou contra a economia popular, contra o sistema financeiro nacional, contra normas de defesa da concorrência, contra as relações de consumo, fé pública, ou a propriedade.`,
    `Cláusula 9ª.\n\nAo término do cada exercício social, em 31 de dezembro, o administrador prestará contas justificadas da administração, procedendo à elaboração do inventário, do balanço patrimonial e do balanço de resultado econômico, nos quatro meses seguintes ao término do exercício social.`,
    `Cláusula 10ª.\n\nA sociedade poderá a qualquer tempo, abrir ou fechar filial ou outra dependência, mediante alteração contratual assinada pela titular.`,
    `Cláusula 11ª\n\nA participação do sócio nos lucros e nas perdas corresponde à exata proporção das respectivas quotas sociais.`,
    `Cláusula 12ª:\n\nEm caso de falecimento do único sócio a sociedade limitada unipessoal poderá continuar com suas atividades com os herdeiros e/ou sucessores do "de cujus" ou do incapaz. Não sendo possível, ou inexistindo interesse destes, a sociedade poderá ser dissolvida.`,
    `Cláusula 13ª.\n\nA sociedade tem por foro contratual a comarca de ${foroComarca}, Estado de ${foroEstado}, para dirimir quaisquer litígios decorrentes deste contrato social, renunciando-se expressamente a qualquer outro, por muito especial que seja.`,
  ];

  const fullText = `CONTRATO SOCIAL DE SOCIEDADE EMPRESÁRIA LIMITADA UNIPESSOAL POR TRANSFORMAÇÃO DE EMPRESÁRIO INDIVIDUAL

Por este instrumento particular, ${v('NOME_SOCIO')}, brasileira(a), empresário(a), nascido(a) em ${v('NASCIMENTO_SOCIO')}, inscrito na cédula de identidade ${v('RG_SOCIO')} e CPF ${v('CPF_SOCIO')}, residente na ${v('ENDERECO_SOCIO')}.

Titular da Empresário Individual sob a ${v('FIRMA_EI')}, com sede empresarial na ${v('ENDERECO_EI')}, registrado na JUCESP sob NIRE ${v('NIRE')}, inscrito no CNPJ sob nº ${v('CNPJ')}, nos termos da lei, transforma o seu registro de EMPRESÁRIO INDIVIDUAL em Sociedade Empresária, na condição de sócio único, nos termos da Lei nº 10.406/2002, art. 1.052 e seus §§ 1º e 2º, incluídos pela Lei nº 13.784, de 20/09/2019, estipulando-se o CONTRATO SOCIAL, o qual passará a vigorar nos seguintes termos e condições:

${transformationClauses.join('\n\n')}

─────────────────────────────────────────────────

CONSOLIDAÇÃO DO CONTRATO SOCIAL DA SOCIEDADE LIMITADA UNIPESSOAL
CNPJ ${v('CNPJ')}
NIRE ${v('NIRE')}

${v('NOME_SOCIO')}, brasileira(a), empresário(a), nascido(a) em ${v('NASCIMENTO_SOCIO')}, inscrito na cédula de identidade ${v('RG_SOCIO')} e CPF ${v('CPF_SOCIO')}, residente na ${v('ENDERECO_SOCIO')}.

Único sócio da sociedade limitada unipessoal que gira sob o nome ${v('RAZAO_SOCIAL_SLU')}, com sede na ${enderecoSede}, inscrito no CNPJ/MF: ${v('CNPJ')}, RESOLVE, por este instrumento, consolidar o contrato social, tornando assim, sem efeito, a partir desta data, as cláusulas e condições contidas no contrato primitivo e alterações anteriores, que adequado às disposições da referida Lei nº 10.406/2002 aplicáveis a este tipo societário, passa a ter a seguinte redação:

${consolidationClauses.join('\n\n')}

${v('CIDADE_ASSINATURA')}, ${v('DIA_ASSINATURA')} ${v('MES_ASSINATURA')} ${v('ANO_ASSINATURA')}

_____________________________________________
${v('NOME_SOCIO')}`;

  return fullText;
}

// Keep the old static template for backward compat in the form generator
export const CONTRACT_TEMPLATE = `CONTRATO SOCIAL DE SOCIEDADE EMPRESÁRIA LIMITADA UNIPESSOAL POR TRANSFORMAÇÃO DE EMPRESÁRIO INDIVIDUAL

Por este instrumento particular, {{NOME_SOCIO}}, brasileira(a), empresário(a), nascido(a) em {{NASCIMENTO_SOCIO}}, inscrito na cédula de identidade {{RG_SOCIO}} e CPF {{CPF_SOCIO}}, residente na {{ENDERECO_SOCIO}}.

Titular da Empresário Individual sob a {{FIRMA_EI}}, com sede empresarial na {{ENDERECO_EI}}, registrado na JUCESP sob NIRE {{NIRE}}, inscrito no CNPJ sob nº {{CNPJ}}, nos termos da lei, transforma o seu registro de EMPRESÁRIO INDIVIDUAL em Sociedade Empresária, na condição de sócio único, nos termos da Lei nº 10.406/2002, art. 1.052 e seus §§ 1º e 2º, incluídos pela Lei nº 13.784, de 20/09/2019, estipulando-se o CONTRATO SOCIAL, o qual passará a vigorar nos seguintes termos e condições:

Cláusula 1ª.

Fica alterada a Razão Social para {{RAZAO_SOCIAL_SLU}}.

Cláusula 2ª.

O objeto passará a ser: {{OJETO_SOCIAL}}.

Cláusula 3ª DA CONSOLIDAÇÃO DO INSTRUMENTO:

Tendo em vista as modificações ora ajustadas, consolida-se o Instrumento Constitutivo, tornando sem efeito, a partir desta data, as cláusulas e condições contidas no contrato primitivo e alterações anteriores, passando a ter a seguinte redação.

─────────────────────────────────────────────────

CONSOLIDAÇÃO DO CONTRATO SOCIAL DA SOCIEDADE LIMITADA UNIPESSOAL
CNPJ {{CNPJ}}
NIRE {{NIRE}}

{{NOME_SOCIO}}, brasileira(a), empresário(a), nascido(a) em {{NASCIMENTO_SOCIO}}, inscrito na cédula de identidade {{RG_SOCIO}} e CPF {{CPF_SOCIO}}, residente na {{ENDERECO_SOCIO}}.

Único sócio da sociedade limitada unipessoal que gira sob o nome {{RAZAO_SOCIAL_SLU}}, com sede na {{ENDERECO_SLU}}, inscrito no CNPJ/MF: {{CNPJ}}, RESOLVE, por este instrumento, consolidar o contrato social, tornando assim, sem efeito, a partir desta data, as cláusulas e condições contidas no contrato primitivo e alterações anteriores, que adequado às disposições da referida Lei nº 10.406/2002 aplicáveis a este tipo societário, passa a ter a seguinte redação:

Cláusula 1ª.

A sociedade unipessoal gira sob o nome empresarial de {{RAZAO_SOCIAL_SLU}}

Cláusula 2ª.

O endereço da sede: {{ENDERECO_SLU}}.

Cláusula 3ª.

O objeto social: {{OJETO_SOCIAL}}

Cláusula 4ª.

O prazo de duração da sociedade será por tempo indeterminado.

Cláusula 5ª

O capital é de {{CAPITAL_SOCIAL}} totalmente subscrito e já integralizado, em moeda corrente do País.

Cláusula 6ª.

A responsabilidade do sócio único é restrita ao valor de suas quotas, desde que inteiramente integralizado a totalidade do capital social, nos termos do art. 1.052 da Lei n.º 10.460/2002 (Código Civil).

Cláusula 7ª.

A administração da sociedade será exercida pelo sócio {{NOME_SOCIO}}, com os poderes e atribuições de administrador, isoladamente, que terá a representação ativa ou passiva da Sociedade, judicial e extrajudicialmente, podendo praticar todos os atos compreendidos no objeto social, sempre no interesse da Sociedade.

Cláusula 8ª.

O administrador declara, sob as penas da lei, de que não está impedida de exercer a administração da sociedade, por lei especial, ou em virtude de condenação criminal, ou por se encontrar sob os efeitos dela, a pena que vede, ainda que temporariamente, o acesso a cargos públicos; ou por crime falimentar, de prevaricação, peita ou suborno, concussão, peculato, ou contra a economia popular, contra o sistema financeiro nacional, contra normas de defesa da concorrência, contra as relações de consumo, fé pública, ou a propriedade.

Cláusula 9ª.

Ao término do cada exercício social, em 31 de dezembro, o administrador prestará contas justificadas da administração, procedendo à elaboração do inventário, do balanço patrimonial e do balanço de resultado econômico, nos quatro meses seguintes ao término do exercício social.

Cláusula 10ª.

A sociedade poderá a qualquer tempo, abrir ou fechar filial ou outra dependência, mediante alteração contratual assinada pela titular.

Cláusula 11ª

A participação do sócio nos lucros e nas perdas corresponde à exata proporção das respectivas quotas sociais.

Cláusula 12ª:

Em caso de falecimento do único sócio a sociedade limitada unipessoal poderá continuar com suas atividades com os herdeiros e/ou sucessores do "de cujus" ou do incapaz. Não sendo possível, ou inexistindo interesse destes, a sociedade poderá ser dissolvida.

Cláusula 13ª.

A sociedade tem por foro contratual a comarca de Guarulhos, Estado de SP, para dirimir quaisquer litígios decorrentes deste contrato social, renunciando-se expressamente a qualquer outro, por muito especial que seja.

{{CIDADE_ASSINATURA}}, {{DIA_ASSINATURA}} {{MES_ASSINATURA}} {{ANO_ASSINATURA}}

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
  CAPITAL_SOCIAL: 'Qual o valor do **capital social**? (ex: 10.000,00)',
  ENDERECO_SLU: 'Qual o **endereço da sede** da SLU?',
  ALTERA_ENDERECO: 'A empresa irá **alterar o endereço**? (Sim/Não)',
  NOVO_ENDERECO: 'Qual o **novo endereço** (logradouro completo)?',
  ALTERA_CAPITAL: 'Haverá **alteração de capital social**? (Sim/Não)',
  NOVO_CAPITAL: 'Qual o **novo valor do capital social**? (ex: 50.000,00)',
  FORO_COMARCA: 'Qual a **comarca do foro**? (ex: Guarulhos)',
  FORO_ESTADO: 'Qual o **estado** do foro? (ex: SP)',
  CIDADE_ASSINATURA: 'Em qual **cidade** será assinado o contrato?',
  DIA_ASSINATURA: 'Qual o **dia** da assinatura?',
  MES_ASSINATURA: 'Qual o **mês** da assinatura? (por extenso, ex: Julho)',
  ANO_ASSINATURA: 'Qual o **ano** da assinatura?',
};

export function getAgentQuestion(key: string): string {
  return AGENT_QUESTIONS[key] || `Informe o valor para **${key}**:`;
}

/**
 * Local storage key for saving wizard progress
 */
export const WIZARD_STORAGE_KEY = 'contract-ei-slu-wizard-progress';

export function saveWizardProgress(values: ContractFormValues, currentFieldIndex: number) {
  localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify({ values, currentFieldIndex, savedAt: new Date().toISOString() }));
}

export function loadWizardProgress(): { values: ContractFormValues; currentFieldIndex: number; savedAt: string } | null {
  try {
    const data = localStorage.getItem(WIZARD_STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function clearWizardProgress() {
  localStorage.removeItem(WIZARD_STORAGE_KEY);
}
