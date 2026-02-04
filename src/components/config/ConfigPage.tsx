import { WhatsAppConfig } from '@/components/config/WhatsAppConfig';
import { MessageTemplates } from '@/components/config/MessageTemplates';
import { Settings } from 'lucide-react';

export function ConfigPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Configurações</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <WhatsAppConfig />
        <MessageTemplates />
      </div>
    </div>
  );
}
