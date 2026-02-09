import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Send, RotateCcw, Copy, SkipForward, ArrowLeft, FileText, Save, FolderOpen, Download } from 'lucide-react';
import {
  CONTRACT_SECTIONS,
  ALL_FIELDS,
  ContractFormValues,
  generateContractText,
  getAgentQuestion,
  saveWizardProgress,
  loadWizardProgress,
  clearWizardProgress,
} from '@/lib/contract-ei-slu';
import { downloadContractAsDocx } from '@/lib/contract-docx';

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
  const [hasSavedProgress, setHasSavedProgress] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  const allFields = ALL_FIELDS;

  // Check for saved progress on mount
  useEffect(() => {
    const saved = loadWizardProgress();
    if (saved) {
      setHasSavedProgress(true);
    }
  }, []);

  // Initialize with first question
  useEffect(() => {
    if (messages.length === 0 && !hasSavedProgress) {
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
  }, [hasSavedProgress]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [currentFieldIndex]);

  const currentField = allFields[currentFieldIndex] || null;
  const isOptionalField = currentField && !currentField.required;
  const isYesNoField = currentField?.type === 'yesno';

  const getNextFieldIndex = useCallback((fromIndex: number, answer: string, currentValues: ContractFormValues): number => {
    let nextIndex = fromIndex + 1;
    const field = allFields[fromIndex];

    // Skip novo sócio fields if no new partner
    if (field.key === 'NOME_SOCIO_NOVO' && !answer) {
      const novoSocioKeys = CONTRACT_SECTIONS.find(s => s.id === 'socio_novo')?.fields.map(f => f.key) || [];
      while (nextIndex < allFields.length && novoSocioKeys.includes(allFields[nextIndex].key)) {
        nextIndex++;
      }
    }

    // Skip NOVO_ENDERECO if answer to ALTERA_ENDERECO is "não"
    if (field.key === 'ALTERA_ENDERECO' && answer.toLowerCase() !== 'sim') {
      // Skip NOVO_ENDERECO
      if (nextIndex < allFields.length && allFields[nextIndex].key === 'NOVO_ENDERECO') {
        nextIndex++;
      }
    }

    // Skip NOVO_CAPITAL if answer to ALTERA_CAPITAL is "não"
    if (field.key === 'ALTERA_CAPITAL' && answer.toLowerCase() !== 'sim') {
      if (nextIndex < allFields.length && allFields[nextIndex].key === 'NOVO_CAPITAL') {
        nextIndex++;
      }
    }

    return nextIndex;
  }, [allFields]);

  const handleSubmitAnswer = () => {
    if (!currentField) return;

    let answer = inputValue.trim();

    // Normalize yes/no
    if (isYesNoField) {
      const lower = answer.toLowerCase();
      if (['s', 'sim', 'yes', 'y', '1'].includes(lower)) {
        answer = 'Sim';
      } else if (['n', 'não', 'nao', 'no', '0', ''].includes(lower)) {
        answer = 'Não';
      }
    }

    // For required fields, don't allow empty (except yesno which defaults to Não)
    if (currentField.required && !answer) {
      if (isYesNoField) {
        answer = 'Não';
      } else {
        toast.error('Este campo é obrigatório');
        return;
      }
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

    const nextIndex = getNextFieldIndex(currentFieldIndex, answer, newValues);

    if (nextIndex >= allFields.length) {
      setMessages(prev => [
        ...prev,
        userMsg,
        {
          id: 'done',
          role: 'agent',
          text: '✅ **Contrato completo!** Todos os dados foram preenchidos. Confira o preview ao vivo à direita. Você pode copiar ou **baixar** o contrato em Word.',
        },
      ]);
      setIsComplete(true);
      setCurrentFieldIndex(nextIndex);
      clearWizardProgress();
    } else {
      const nextField = allFields[nextIndex];
      const sectionChanged = currentField.sectionName !== nextField.sectionName;

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
    setHasSavedProgress(false);
    clearWizardProgress();
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

    setMessages(prev => {
      const newMsgs = [...prev];
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

  const handleSaveProgress = () => {
    saveWizardProgress(values, currentFieldIndex);
    toast.success('Progresso salvo! Você pode voltar depois para continuar.');
  };

  const handleLoadProgress = () => {
    const saved = loadWizardProgress();
    if (!saved) {
      toast.error('Nenhum progresso salvo encontrado');
      return;
    }

    setValues(saved.values);
    setCurrentFieldIndex(saved.currentFieldIndex);
    setHasSavedProgress(false);

    // Rebuild messages from saved values
    const rebuiltMessages: ChatMessage[] = [
      {
        id: 'welcome',
        role: 'agent',
        text: '👋 Olá! Vou te guiar na criação do contrato de **Transformação EI → SLU**. Vou fazer uma pergunta por vez. Vamos começar!',
      },
    ];

    for (let i = 0; i < saved.currentFieldIndex && i < allFields.length; i++) {
      const field = allFields[i];
      const value = saved.values[field.key];

      // Add section change messages
      if (i === 0 || allFields[i - 1].sectionName !== field.sectionName) {
        if (i > 0) {
          rebuiltMessages.push({
            id: `section-${i}`,
            role: 'agent',
            text: `📋 Agora vamos para: **${field.sectionName}**`,
          });
        }
      }

      rebuiltMessages.push({
        id: `q-${i}`,
        role: 'agent',
        text: getAgentQuestion(field.key),
        fieldKey: field.key,
      });

      rebuiltMessages.push({
        id: `u-${i}`,
        role: 'user',
        text: value || '(pulado)',
      });
    }

    // Add next question
    if (saved.currentFieldIndex < allFields.length) {
      const nextField = allFields[saved.currentFieldIndex];
      const prevField = saved.currentFieldIndex > 0 ? allFields[saved.currentFieldIndex - 1] : null;

      if (prevField && prevField.sectionName !== nextField.sectionName) {
        rebuiltMessages.push({
          id: `section-${saved.currentFieldIndex}`,
          role: 'agent',
          text: `📋 Agora vamos para: **${nextField.sectionName}**`,
        });
      }

      rebuiltMessages.push({
        id: `q-${saved.currentFieldIndex}`,
        role: 'agent',
        text: getAgentQuestion(nextField.key),
        fieldKey: nextField.key,
      });

      rebuiltMessages.push({
        id: 'restored',
        role: 'agent',
        text: `🔄 Progresso restaurado! Continuando de onde parou (${Object.values(saved.values).filter(v => v?.trim()).length} campos preenchidos).`,
      });
    }

    setMessages(rebuiltMessages);
    toast.success('Progresso restaurado!');
  };

  const contractPreview = useMemo(() => {
    return generateContractText(values);
  }, [values]);

  const handleCopyContract = () => {
    navigator.clipboard.writeText(contractPreview);
    toast.success('Contrato copiado para a área de transferência!');
  };

  const handleDownloadDocx = async () => {
    try {
      const clientName = values['NOME_SOCIO'] || 'contrato';
      const filename = `Contrato-EI-SLU-${clientName.replace(/\s+/g, '-')}.docx`;
      await downloadContractAsDocx(contractPreview, filename);
      toast.success('Contrato baixado com sucesso!');
    } catch (error) {
      console.error('Error generating docx:', error);
      toast.error('Erro ao gerar o arquivo Word');
    }
  };

  const filledCount = Object.values(values).filter(v => v?.trim()).length;
  const totalFields = allFields.length;
  const progress = Math.round((currentFieldIndex / totalFields) * 100);

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

  // Show restore prompt
  if (hasSavedProgress && messages.length === 0) {
    const saved = loadWizardProgress();
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Assistente de Contrato EI → SLU</h2>
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle className="text-base">📂 Progresso salvo encontrado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Você tem um preenchimento salvo de{' '}
              <strong>{saved?.savedAt ? new Date(saved.savedAt).toLocaleString('pt-BR') : 'data desconhecida'}</strong>.
            </p>
            <div className="flex gap-2">
              <Button onClick={handleLoadProgress} className="flex-1">
                <FolderOpen className="mr-2 h-4 w-4" />
                Continuar de onde parou
              </Button>
              <Button variant="outline" onClick={() => { setHasSavedProgress(false); clearWizardProgress(); }} className="flex-1">
                <RotateCcw className="mr-2 h-4 w-4" />
                Começar do zero
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                  {isYesNoField ? (
                    <div className="flex-1 flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setInputValue('Sim');
                          setTimeout(() => {
                            setInputValue('Sim');
                            // Trigger submit manually
                          }, 0);
                        }}
                        onDoubleClick={() => {
                          setInputValue('Sim');
                        }}
                      >
                        ✅ Sim
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setInputValue('Não');
                          setTimeout(() => {
                            setInputValue('Não');
                          }, 0);
                        }}
                      >
                        ❌ Não
                      </Button>
                    </div>
                  ) : currentField.type === 'textarea' ? (
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
                  {!isYesNoField && (
                    <Button size="icon" onClick={handleSubmitAnswer}>
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {isYesNoField && inputValue && (
                  <div className="flex justify-center">
                    <Button size="sm" onClick={handleSubmitAnswer}>
                      <Send className="mr-1 h-3 w-3" />
                      Confirmar: {inputValue}
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  {currentFieldIndex > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleGoBack}>
                      <ArrowLeft className="mr-1 h-3 w-3" />
                      Voltar
                    </Button>
                  )}
                  {isOptionalField && !isYesNoField && (
                    <Button variant="ghost" size="sm" onClick={handleSkip}>
                      <SkipForward className="mr-1 h-3 w-3" />
                      Pular
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleSaveProgress}>
                    <Save className="mr-1 h-3 w-3" />
                    Salvar progresso
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleReset} className="ml-auto">
                    <RotateCcw className="mr-1 h-3 w-3" />
                    Recomeçar
                  </Button>
                </div>
              </div>
            )}

            {isComplete && (
              <div className="border-t p-3 shrink-0 space-y-2">
                <div className="flex gap-2">
                  <Button onClick={handleDownloadDocx} className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Baixar Word (.docx)
                  </Button>
                  <Button variant="outline" onClick={handleCopyContract}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Novo
                  </Button>
                </div>
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
              <div className="flex gap-1">
                {filledCount > 0 && (
                  <>
                    <Button variant="ghost" size="sm" onClick={handleDownloadDocx}>
                      <Download className="mr-1 h-3 w-3" />
                      Baixar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCopyContract}>
                      <Copy className="mr-1 h-3 w-3" />
                      Copiar
                    </Button>
                  </>
                )}
              </div>
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
