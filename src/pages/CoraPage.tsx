import { useState } from 'react';
import {
  useCoraEmpresas,
  useCreateCoraEmpresa,
  useUpdateCoraEmpresa,
  useDeleteCoraEmpresa,
  useCoraConfig,
  useUpsertCoraConfig,
  CoraEmpresa,
  CoraEmpresaFormData,
} from '@/hooks/useCora';
import { useClients } from '@/hooks/useClients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Loader2, Settings2, Building2 } from 'lucide-react';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function CoraPage() {
  const [activeTab, setActiveTab] = useState('empresas');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cora - Boletos</h1>
        <p className="text-sm text-muted-foreground">
          Gestão de empresas e boletos via API Cora
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="empresas" className="gap-2">
            <Building2 className="h-4 w-4" />
            Empresas
          </TabsTrigger>
          <TabsTrigger value="parametros" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Parâmetros
          </TabsTrigger>
        </TabsList>

        <TabsContent value="empresas" className="mt-4">
          <EmpresasTab />
        </TabsContent>
        <TabsContent value="parametros" className="mt-4">
          <ParametrosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===================== EMPRESAS TAB =====================

function EmpresasTab() {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<CoraEmpresa | null>(null);
  const { data: empresas, isLoading } = useCoraEmpresas();
  const { data: clients } = useClients();
  const createEmpresa = useCreateCoraEmpresa();
  const updateEmpresa = useUpdateCoraEmpresa();
  const deleteEmpresa = useDeleteCoraEmpresa();

  const [formData, setFormData] = useState<CoraEmpresaFormData>({
    client_id: null,
    client_name: '',
    cnpj: '',
    telefone: '',
    email: '',
    dia_vencimento: 15,
    valor_mensal: 0,
    forma_envio: 'EMAIL',
    observacoes: '',
  });
  const [clientInputMode, setClientInputMode] = useState<'select' | 'free'>('select');

  const openNew = () => {
    setEditing(null);
    setClientInputMode('select');
    setFormData({
      client_id: null,
      client_name: '',
      cnpj: '',
      telefone: '',
      email: '',
      dia_vencimento: 15,
      valor_mensal: 0,
      forma_envio: 'EMAIL',
      observacoes: '',
    });
    setIsOpen(true);
  };

  const openEdit = (emp: CoraEmpresa) => {
    setEditing(emp);
    setClientInputMode(emp.client_id ? 'select' : 'free');
    setFormData({
      client_id: emp.client_id,
      client_name: emp.client_name || emp.client?.name || '',
      cnpj: emp.cnpj,
      telefone: emp.telefone || '',
      email: emp.email || '',
      dia_vencimento: emp.dia_vencimento,
      valor_mensal: emp.valor_mensal,
      forma_envio: emp.forma_envio || 'EMAIL',
      observacoes: emp.observacoes || '',
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized = {
      ...formData,
      client_id: formData.client_id || null,
      client_name: formData.client_name || null,
      observacoes: formData.observacoes || null,
    };
    if (editing) {
      await updateEmpresa.mutateAsync({ id: editing.id, data: sanitized });
    } else {
      await createEmpresa.mutateAsync(sanitized as CoraEmpresaFormData);
    }
    setIsOpen(false);
  };

  const totalMensal = empresas?.filter(e => e.is_active).reduce((s, e) => s + (e.valor_mensal || 0), 0) || 0;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          <strong>Total Mensal (ativas):</strong> {formatCurrency(totalMensal)} · {empresas?.filter(e => e.is_active).length || 0} empresas
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Empresa
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !empresas?.length ? (
        <div className="text-center py-8 text-muted-foreground">Nenhuma empresa cadastrada</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Valor Mensal</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Envio</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresas.map((emp) => (
                  <TableRow key={emp.id} className={!emp.is_active ? 'opacity-60 bg-muted/30' : ''}>
                    <TableCell className="font-medium">
                      {emp.client?.name || emp.client_name || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{emp.cnpj}</TableCell>
                    <TableCell>{formatCurrency(emp.valor_mensal)}</TableCell>
                    <TableCell>Dia {emp.dia_vencimento}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{emp.forma_envio}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={emp.is_active ? 'default' : 'secondary'}>
                        {emp.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteEmpresa.mutate(emp.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Client selector */}
            <div className="space-y-2">
              <Label>Cliente</Label>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant={clientInputMode === 'select' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setClientInputMode('select');
                    setFormData({ ...formData, client_name: '', client_id: null });
                  }}
                >
                  Selecionar cadastrado
                </Button>
                <Button
                  type="button"
                  variant={clientInputMode === 'free' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setClientInputMode('free');
                    setFormData({ ...formData, client_id: null });
                  }}
                >
                  Nome livre
                </Button>
              </div>
              {clientInputMode === 'select' ? (
                <Select
                  value={formData.client_id || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, client_id: v === 'none' ? null : v, client_name: null })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={formData.client_name || ''}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value, client_id: null })}
                  placeholder="Nome do cliente"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>CNPJ *</Label>
              <Input
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Mensal</Label>
                <Input
                  type="number"
                  value={formData.valor_mensal || ''}
                  onChange={(e) => setFormData({ ...formData, valor_mensal: e.target.value ? Number(e.target.value) : 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Dia do Vencimento</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={formData.dia_vencimento || 15}
                  onChange={(e) => setFormData({ ...formData, dia_vencimento: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={formData.telefone || ''}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Forma de Envio</Label>
              <Select
                value={formData.forma_envio || 'EMAIL'}
                onValueChange={(v) => setFormData({ ...formData, forma_envio: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes || ''}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createEmpresa.isPending || updateEmpresa.isPending}>
                {createEmpresa.isPending || updateEmpresa.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ===================== PARÂMETROS TAB =====================

function ParametrosTab() {
  const { data: configs, isLoading } = useCoraConfig();
  const upsertConfig = useUpsertCoraConfig();

  const getConfigValue = (chave: string, field: string, defaultVal = '') => {
    const cfg = configs?.find(c => c.chave === chave);
    return (cfg?.valor as any)?.[field] ?? defaultVal;
  };

  const [apiConfig, setApiConfig] = useState({
    client_id: '',
    base_url: 'https://api.cora.com.br',
    matls_url: 'https://matls-clients.api.cora.com.br',
    backend_token_url: '',
  });

  const [whatsappConfig, setWhatsappConfig] = useState({
    api_url: '',
    token: '',
  });

  // Load configs when data arrives
  const loaded = configs && configs.length >= 0;
  if (loaded && !apiConfig.client_id && configs.length > 0) {
    const api = configs.find(c => c.chave === 'cora_api');
    const wpp = configs.find(c => c.chave === 'whatsapp');
    if (api?.valor) {
      const v = api.valor as any;
      setApiConfig({
        client_id: v.client_id || '',
        base_url: v.base_url || 'https://api.cora.com.br',
        matls_url: v.matls_url || 'https://matls-clients.api.cora.com.br',
        backend_token_url: v.backend_token_url || '',
      });
    }
    if (wpp?.valor) {
      const v = wpp.valor as any;
      setWhatsappConfig({
        api_url: v.api_url || '',
        token: v.token || '',
      });
    }
  }

  const saveApiConfig = () => {
    upsertConfig.mutate({ chave: 'cora_api', valor: apiConfig });
  };

  const saveWhatsappConfig = () => {
    upsertConfig.mutate({ chave: 'whatsapp', valor: whatsappConfig });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* API Cora Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API Cora</CardTitle>
          <CardDescription>
            Configurações de conexão com a API Cora (mTLS). O token é obtido via backend com certificados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Client ID Cora</Label>
            <Input
              value={apiConfig.client_id}
              onChange={(e) => setApiConfig({ ...apiConfig, client_id: e.target.value })}
              placeholder="int-3udMdndv53r4OZLtakIhF3"
            />
          </div>
          <div className="space-y-2">
            <Label>Base URL (API pública)</Label>
            <Input
              value={apiConfig.base_url}
              onChange={(e) => setApiConfig({ ...apiConfig, base_url: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>mTLS URL (autenticação)</Label>
            <Input
              value={apiConfig.matls_url}
              onChange={(e) => setApiConfig({ ...apiConfig, matls_url: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>URL do Backend (get-token)</Label>
            <Input
              value={apiConfig.backend_token_url}
              onChange={(e) => setApiConfig({ ...apiConfig, backend_token_url: e.target.value })}
              placeholder="https://sua-vps.com/api/cora/get-token"
            />
            <p className="text-xs text-muted-foreground">
              URL do seu backend Node.js (VPS/EasyPanel) que possui os certificados e faz mTLS.
            </p>
          </div>
          <Button onClick={saveApiConfig} disabled={upsertConfig.isPending}>
            Salvar Configurações API
          </Button>
        </CardContent>
      </Card>

      {/* WhatsApp Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">WhatsApp</CardTitle>
          <CardDescription>
            Configurações para envio de boletos via WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL da API WhatsApp</Label>
            <Input
              value={whatsappConfig.api_url}
              onChange={(e) => setWhatsappConfig({ ...whatsappConfig, api_url: e.target.value })}
              placeholder="https://api.wascript.com.br/..."
            />
          </div>
          <div className="space-y-2">
            <Label>Token WhatsApp</Label>
            <Input
              type="password"
              value={whatsappConfig.token}
              onChange={(e) => setWhatsappConfig({ ...whatsappConfig, token: e.target.value })}
            />
          </div>
          <Button onClick={saveWhatsappConfig} disabled={upsertConfig.isPending}>
            Salvar Configurações WhatsApp
          </Button>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Arquitetura da Integração</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong>1. Token:</strong> O backend (VPS com certificados) autentica via mTLS em <code>matls-clients.api.cora.com.br/token</code> e retorna o access_token.</p>
          <p><strong>2. Busca:</strong> Com o token, busca boletos em <code>/v2/invoices?search=CNPJ&start=...&end=...</code>.</p>
          <p><strong>3. Status:</strong> OPEN, PAID, LATE, CANCELLED, DRAFT, IN_PAYMENT.</p>
          <p><strong>4. Cache:</strong> Boletos são armazenados na tabela <code>cora_boletos</code> para consulta rápida sem chamar a API toda vez.</p>
          <p><strong>5. Envio:</strong> Busca boleto por CNPJ + competência, baixa PDF, envia via WhatsApp/Email. Registra em <code>cora_envios</code>.</p>
        </CardContent>
      </Card>
    </div>
  );
}
