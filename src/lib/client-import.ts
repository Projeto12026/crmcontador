import * as XLSX from 'xlsx';
import type { AcquisitionChannel, ClientFormData, ClientStatus } from '@/types/crm';

export interface ParsedImportRow {
  lineNumber: number;
  documentDigits: string;
  payload: ClientFormData;
  /** Campos opcionais preenchidos na planilha (para não apagar dados no update) */
  touchedOptional: Set<keyof ClientFormData>;
}

const ACQUISITION_VALUES = new Set<string>([
  'whatsapp',
  'social_media',
  'website_form',
  'referral',
  'direct_prospecting',
  'google_ads',
  'google_my_business',
  'site',
  'events',
  'other',
]);

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Mapeia cabeçalho normalizado -> campo do formulário */
const HEADER_MAP: Record<string, keyof ClientFormData> = {
  cnpj: 'document',
  cpf_cnpj: 'document',
  documento: 'document',
  razao_social: 'name',
  nome_razao_social: 'name',
  razao: 'name',
  nome_fantasia: 'trading_name',
  fantasia: 'trading_name',
  email: 'email',
  telefone: 'phone',
  fone: 'phone',
  celular: 'phone',
  endereco: 'address',
  logradouro: 'address',
  cidade: 'city',
  uf: 'state',
  estado: 'state',
  cep: 'zip_code',
  observacoes: 'notes',
  notas: 'notes',
  obs: 'notes',
  status: 'status',
  canal_entrada: 'acquisition_source',
  canal: 'acquisition_source',
  origem: 'acquisition_source',
};

function onlyDigits(s: string): string {
  return String(s).replace(/\D/g, '');
}

function parseStatus(raw: string): ClientStatus | undefined {
  const t = raw.trim().toLowerCase();
  if (['ativo', 'active', 'a'].includes(t)) return 'active';
  if (['inativo', 'inactive', 'i'].includes(t)) return 'inactive';
  if (['bloqueado', 'blocked', 'b'].includes(t)) return 'blocked';
  return undefined;
}

function parseAcquisition(raw: string): AcquisitionChannel | undefined {
  const t = raw.trim().toLowerCase().replace(/\s+/g, '_');
  if (ACQUISITION_VALUES.has(t)) return t as AcquisitionChannel;
  const aliases: Record<string, AcquisitionChannel> = {
    whats: 'whatsapp',
    zap: 'whatsapp',
    instagram: 'social_media',
    facebook: 'social_media',
    google: 'google_ads',
    gmb: 'google_my_business',
    indicacao: 'referral',
    indicacao_: 'referral',
    site_internet: 'site',
    formulario: 'website_form',
    form: 'website_form',
    prospeccao: 'direct_prospecting',
    prospeccao_direta: 'direct_prospecting',
    evento: 'events',
    outros: 'other',
    outro: 'other',
  };
  return aliases[t];
}

export function downloadClientsImportTemplate(): void {
  const headers = [
    'CNPJ',
    'Razão Social',
    'Nome Fantasia',
    'Email',
    'Telefone',
    'Endereço',
    'Cidade',
    'UF',
    'CEP',
    'Observações',
    'Status',
    'Canal de entrada',
  ];
  const example = [
    '11222333000181',
    'Empresa Exemplo LTDA',
    'Exemplo',
    'contato@exemplo.com.br',
    '(11) 98765-4321',
    'Rua das Flores, 100',
    'São Paulo',
    'SP',
    '01310100',
    '',
    'ativo',
    'whatsapp',
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = headers.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  XLSX.writeFile(wb, 'modelo_importacao_clientes.xlsx');
}

/**
 * Lê .xlsx, .xls ou .csv (primeira aba / primeira planilha).
 * CNPJ (ou coluna documento) é obrigatório para cada linha válida; usa os dígitos para casar com cadastro existente.
 */
export function parseClientsImportFile(buffer: ArrayBuffer): {
  rows: ParsedImportRow[];
  errors: string[];
} {
  const errors: string[] = [];
  const rows: ParsedImportRow[] = [];

  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    errors.push('Arquivo sem planilhas.');
    return { rows, errors };
  }
  const sheet = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' }) as unknown[][];

  if (!aoa.length) {
    errors.push('Planilha vazia.');
    return { rows, errors };
  }

  const headerRow = aoa[0].map((c) => String(c ?? '').trim());
  const colIndexByField = new Map<keyof ClientFormData, number>();
  const cnpjColIndexes: number[] = [];

  headerRow.forEach((h, idx) => {
    if (!h) return;
    const key = HEADER_MAP[normalizeHeader(h)];
    if (key) {
      if (key === 'document') cnpjColIndexes.push(idx);
      else if (!colIndexByField.has(key)) colIndexByField.set(key, idx);
    }
    if (normalizeHeader(h) === 'cnpj') {
      if (!cnpjColIndexes.includes(idx)) cnpjColIndexes.push(idx);
    }
  });

  const cnpjCol = cnpjColIndexes[0];
  const nameCol = colIndexByField.get('name');

  if (cnpjCol === undefined) {
    errors.push(
      'Coluna CNPJ não encontrada. Use o modelo fornecido: a planilha deve ter a coluna "CNPJ" para sincronizar o cadastro.',
    );
    return { rows, errors };
  }
  if (nameCol === undefined) {
    errors.push('Coluna "Razão Social" (ou equivalente) não encontrada.');
    return { rows, errors };
  }

  for (let r = 1; r < aoa.length; r++) {
    const lineNumber = r + 1;
    const line = aoa[r];
    if (!line || line.every((c) => String(c ?? '').trim() === '')) continue;

    const cnpjRaw = String(line[cnpjCol] ?? '').trim();
    const nameRaw = String(line[nameCol] ?? '').trim();
    const documentDigits = onlyDigits(cnpjRaw);

    if (!documentDigits) {
      errors.push(`Linha ${lineNumber}: CNPJ vazio — preencha o CNPJ para importar ou atualizar o cliente.`);
      continue;
    }
    if (documentDigits.length !== 14) {
      errors.push(
        `Linha ${lineNumber}: CNPJ "${cnpjRaw}" deve ter 14 dígitos (encontrado ${documentDigits.length}).`,
      );
      continue;
    }
    if (!nameRaw) {
      errors.push(`Linha ${lineNumber}: Razão Social é obrigatória.`);
      continue;
    }

    const touchedOptional = new Set<keyof ClientFormData>();
    const payload: ClientFormData = {
      name: nameRaw,
      document: cnpjRaw || documentDigits,
      document_type: 'CNPJ',
      status: 'active',
    };

    const setIfCol = (field: keyof ClientFormData, col: number | undefined) => {
      if (col === undefined) return;
      const raw = String(line[col] ?? '').trim();
      if (raw === '') return;
      if (field === 'status') {
        const st = parseStatus(raw);
        if (st) {
          touchedOptional.add(field);
          payload.status = st;
        } else {
          errors.push(`Linha ${lineNumber}: Status inválido "${raw}" (use ativo, inativo ou bloqueado).`);
        }
        return;
      }
      if (field === 'acquisition_source') {
        const ac = parseAcquisition(raw);
        if (ac) {
          touchedOptional.add(field);
          payload.acquisition_source = ac;
        } else {
          errors.push(
            `Linha ${lineNumber}: Canal de entrada inválido "${raw}". Use uma chave do sistema (ex.: whatsapp, referral, site).`,
          );
        }
        return;
      }
      touchedOptional.add(field);
      (payload as Record<string, unknown>)[field] = raw;
    };

    colIndexByField.forEach((col, field) => {
      if (field === 'name') return;
      setIfCol(field, col);
    });

    rows.push({
      lineNumber,
      documentDigits,
      payload,
      touchedOptional,
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push('Nenhuma linha de dados encontrada (além do cabeçalho).');
  }

  return { rows, errors };
}
