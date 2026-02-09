import { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Send, RotateCcw, Copy, SkipForward, ArrowLeft, FileText } from 'lucide-react';
import {
  CONTRACT_SECTIONS,
  ALL_FIELDS,
  CONTRACT_TEMPLATE,
  ContractFormValues,
  replacePlaceholders,
  getAgentQuestion,
} from '@/lib/contract-ei-slu';

interface ChatMessage {
  id: string;
  role: 'agent' | 'user';
  text: string;
  fieldKey?: string;
}

export function ContractAgentWizard() {
  const [values, setValues] = useState<ContractFormValues>({});
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  const allFields = ALL_FIELDS;

  // Initialize with first question
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'agent',
          text: '👋 Olá! Vou te guiar na criação do contrato de **Transformação EI → SLU**. Vou fazer uma pergunta por vez. Vamos começar!',
        },
        {
          id: 'q-0',
          role: 'agent',
          text: getAgentQuestion(allFields[0].key),
          fieldKey: allFields[0].key,
        },
      ]);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [currentFieldIndex]);

  const currentField = allFields[currentFieldIndex] || null;
  const isOptionalField = currentField && !currentField.required;

  const handleSubmitAnswer = () => {
    if (!currentField) return;

    const answer = inputValue.trim();

    // For required fields, don't allow empty
    if (currentField.required && !answer) {
      toast.error('Este campo é obrigatório');
      return;
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: `u-${currentFieldIndex}`,
      role: 'user',
      text: answer || '(pulado)',
    };

    // Save value
    const newValues = { ...values };
    if (answer) {
      newValues[currentField.key] = answer;
    }
    setValues(newValues);

    // Check if we should skip "novo sócio" section
    let nextIndex = currentFieldIndex + 1;
    if (currentField.key === 'NOME_SOCIO_NOVO' && !answer) {
      // Skip all novo sócio fields
      const novoSocioKeys = CONTRACT_SECTIONS.find(s => s.id === 'socio_novo')?.fields.map(f => f.key) || [];
      while (nextIndex < allFields.length && novoSocioKeys.includes(allFields[nextIndex].key)) {
        nextIndex++;
      }
    }

    if (nextIndex >= allFields.length) {
      // Done!
      setMessages(prev => [
        ...prev,
        userMsg,
        {
          id: 'done',
          role: 'agent',
          text: '✅ **Contrato completo!** Todos os dados foram preenchidos. Confira o preview ao vivo à direita. Você pode copiar o texto completo do contrato.',
        },
      ]);
      setIsComplete(true);
      setCurrentFieldIndex(nextIndex);
    } else {
      // Next question
      const nextField = allFields[nextIndex];
      const sectionChanged =
        currentField.sectionName !== nextField.sectionName;

      const newMessages: ChatMessage[] = [userMsg];

      if (sectionChanged) {
        newMessages.push({
          id: `section-${nextIndex}`,
          role: 'agent',
          text: `📋 Agora vamos para: **${nextField.sectionName}**`,
        });
      }

      newMessages.push({
        id: `q-${nextIndex}`,
        role: 'agent',
        text: getAgentQuestion(nextField.key),
        fieldKey: nextField.key,
      });

      setMessages(prev => [...prev, ...newMessages]);
      setCurrentFieldIndex(nextIndex);
    }

    setInputValue('');
  };

  const handleSkip = () => {
    if (!currentField || currentField.required) return;
    setInputValue('');
    handleSubmitAnswer();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitAnswer();
    }
  };

  const handleReset = () => {
    setValues({});
    setCurrentFieldIndex(0);
    setIsComplete(false);
    setMessages([
      {
        id: 'welcome',
        role: 'agent',
        text: '👋 Olá! Vou te guiar na criação do contrato de **Transformação EI → SLU**. Vou fazer uma pergunta por vez. Vamos começar!',
      },
      {
        id: 'q-0',
        role: 'agent',
        text: getAgentQuestion(allFields[0].key),
        fieldKey: allFields[0].key,
      },
    ]);
    setInputValue('');
    toast.info('Recomeçando do zero');
  };

  const handleGoBack = () => {
    if (currentFieldIndex <= 0) return;
    const prevIndex = currentFieldIndex - 1;
    const prevField = allFields[prevIndex];
    
    // Remove last user + agent messages
    setMessages(prev => {
      const newMsgs = [...prev];
      // Remove messages until we find the previous question
      while (newMsgs.length > 0) {
        const last = newMsgs[newMsgs.length - 1];
        if (last.fieldKey === prevField.key && last.role === 'agent') break;
        newMsgs.pop();
      }
      return newMsgs;
    });

    setCurrentFieldIndex(prevIndex);
    setInputValue(values[prevField.key] || '');
    setIsComplete(false);
  };

  const contractPreview = useMemo(() => {
    return replacePlaceholders(CONTRACT_TEMPLATE, values);
  }, [values]);

  const handleCopyContract = () => {
    navigator.clipboard.writeText(contractPreview);
    toast.success('Contrato copiado para a área de transferência!');
  };

  const filledCount = Object.values(values).filter(v => v?.trim()).length;
  const totalFields = allFields.length;
  const progress = Math.round((currentFieldIndex / totalFields) * 100);

  // Render markdown bold
  const renderText = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <strong key={i}>{part}</strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Assistente de Contrato EI → SLU</h2>
          <p className="text-sm text-muted-foreground">
            Responda às perguntas para gerar o contrato automaticamente
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {filledCount}/{totalFields} campos
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {progress}%
          </Badge>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: 'calc(100vh - 280px)' }}>
        {/* Chat Panel */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-base flex items-center gap-2">
              💬 Assistente
              {currentField && (
                <Badge variant="outline" className="text-xs font-normal">
                  {currentField.sectionName}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-3 py-4">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-4 py-2 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {renderText(msg.text)}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Input area */}
            {!isComplete && currentField && (
              <div className="border-t p-3 shrink-0 space-y-2">
                <div className="flex gap-2">
                  {currentField.type === 'textarea' ? (
                    <Textarea
                      ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      placeholder={currentField.hint}
                      rows={2}
                      className="flex-1 text-sm"
                      onKeyDown={handleKeyDown}
                    />
                  ) : (
                    <Input
                      ref={inputRef as React.RefObject<HTMLInputElement>}
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      placeholder={currentField.hint}
                      className="flex-1 text-sm"
                      onKeyDown={handleKeyDown}
                    />
                  )}
                  <Button size="icon" onClick={handleSubmitAnswer}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  {currentFieldIndex > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleGoBack}>
                      <ArrowLeft className="mr-1 h-3 w-3" />
                      Voltar
                    </Button>
                  )}
                  {isOptionalField && (
                    <Button variant="ghost" size="sm" onClick={handleSkip}>
                      <SkipForward className="mr-1 h-3 w-3" />
                      Pular
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleReset} className="ml-auto">
                    <RotateCcw className="mr-1 h-3 w-3" />
                    Recomeçar
                  </Button>
                </div>
              </div>
            )}

            {isComplete && (
              <div className="border-t p-3 shrink-0 flex gap-2">
                <Button onClick={handleCopyContract} className="flex-1">
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar Contrato
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Novo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Preview Panel */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="pb-2 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Preview ao Vivo
              </CardTitle>
              {filledCount > 0 && (
                <Button variant="ghost" size="sm" onClick={handleCopyContract}>
                  <Copy className="mr-1 h-3 w-3" />
                  Copiar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full px-4">
              <div className="py-4">
                <div className="bg-background border rounded-lg p-6 shadow-sm font-serif text-sm leading-relaxed whitespace-pre-wrap">
                  {contractPreview}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
