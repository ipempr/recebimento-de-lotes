import React, { useState } from 'react';
import { 
  Bell, 
  AlertCircle, 
  Plus, 
  Trash2, 
  X, 
  Check, 
  Calendar, 
  FileText, 
  ChevronRight, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  History, 
  Info,
  CheckCircle2,
  Copy,
  Printer,
  Mail,
  MessageSquare,
  Search,
  CheckSquare,
  AlertTriangle,
  Send,
  HelpCircle,
  Phone,
  Sparkles,
  Eye,
  BellOff
} from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AVAILABLE_ICONS, getIconComponent } from './NotificationTemplatesManager';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface NotificationsPanelProps {
  batches: any[];
  pacs: any[];
  nonConformityRecords: any[];
  nonConformitiesConfigs: any[];
  notificationTypes: any[];
  generatedNotifications: any[];
  setGeneratedNotifications: React.Dispatch<React.SetStateAction<any[]>>;
  isLocalMode: boolean;
  handleFirestoreError: (err: any, op: string, col: string) => void;
  logoUrl?: string;
  signatures?: any[];
}

interface GroupedNC {
  reasonName: string;
  plates: string[];
}

export default function NotificationsPanel({
  batches,
  pacs,
  nonConformityRecords,
  nonConformitiesConfigs,
  notificationTypes,
  generatedNotifications,
  setGeneratedNotifications,
  isLocalMode,
  handleFirestoreError,
  logoUrl = '',
  signatures = []
}: NotificationsPanelProps) {
  
  const [selectedBatchForDetails, setSelectedBatchForDetails] = useState<any | null>(null);
  const [generatingForPac, setGeneratingForPac] = useState<any | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [notificationNotes, setNotificationNotes] = useState<string>('');
  const [isSavingNotification, setIsSavingNotification] = useState<boolean>(false);
  const [submittingError, setSubmittingError] = useState<string | null>(null);
  const [notificationSuccess, setNotificationSuccess] = useState<string | null>(null);
  const [expandedPacHistory, setExpandedPacHistory] = useState<{ [key: string]: boolean }>({});

  // Template Preview states inside NotificationsPanel
  const [viewingNotification, setViewingNotification] = useState<any | null>(null);
  const [selectedSignatureId, setSelectedSignatureId] = useState<string>('');
  const [previewChannel, setPreviewChannel] = useState<'oficio' | 'email' | 'whatsapp'>('oficio');
  const [copiedPreviewSuccess, setCopiedPreviewSuccess] = useState<boolean>(false);

  // Pre-compiled editable values inside the Preview & Export modal
  const [editableOficioTitle, setEditableOficioTitle] = useState('');
  const [editableOficioProcess, setEditableOficioProcess] = useState('');
  const [editableOficioIntro, setEditableOficioIntro] = useState('');
  const [editableOficioSections, setEditableOficioSections] = useState<any[]>([]);
  const [editableEmailSubject, setEditableEmailSubject] = useState('');
  const [editableEmailBody, setEditableEmailBody] = useState('');
  const [editableWhatsapp, setEditableWhatsapp] = useState('');

  // States for consulting, rectifying, and deleting
  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'history'>('pending');
  const [notifSearch, setNotifSearch] = useState('');
  const [viewingNotificationNotes, setViewingNotificationNotes] = useState('');
  const [notifToDelete, setNotifToDelete] = useState<string | null>(null);

  // Parse any Timestamp or date safely
  const getJsDate = (value: any): Date | null => {
    if (!value) return null;
    if (value.toDate && typeof value.toDate === 'function') {
      return value.toDate();
    }
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    if (value.seconds) {
      return new Date(value.seconds * 1000);
    }
    return null;
  };

  const formatDateTime = (value: any) => {
    const d = getJsDate(value);
    return d ? format(d, "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-';
  };

  const formatDateShort = (value: any) => {
    const d = getJsDate(value);
    return d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : '-';
  };

  // Associate each batch with its nonConformities based on mode
  const batchesWithNCs = batches.map(batch => {
    const ncs = isLocalMode 
      ? (batch.nonConformities || []) 
      : (nonConformityRecords || [])
          .filter(nc => nc.recebimento_lote_id === batch.id)
          .map(nc => {
            const reason = nonConformitiesConfigs.find(c => c.id === nc.nao_conformidade_id);
            return {
              id: nc.id,
              nao_conformidade_id: nc.nao_conformidade_id,
              nao_conformidade_name: reason ? reason.name : 'Outro',
              placas: nc.placas || []
            };
          });
    return { ...batch, nonConformities: ncs };
  });

  // Filter for batches with at least one nonconformity plate or marked as delayed (ensaio fora do prazo)
  const activeNCBatches = batchesWithNCs.filter(b => 
    (b.nonConformities && b.nonConformities.length > 0) || b.ensaioForaDoPrazo
  );

  // Group PACs with active nonconformity records
  const pacsWithNC = pacs.map(pac => {
    const pacBatches = activeNCBatches.filter(b => b.pac === pac.name || b.pac === pac.id);
    return {
      ...pac,
      batches: pacBatches
    };
  }).filter(p => p.batches.length > 0);

  // Calculate stats
  const totalNCBatchesCount = activeNCBatches.length;
  const totalGeneratedNotificationsCount = generatedNotifications.length;

  // Group non-conformities by reason
  const getGroupedNonConformities = (nonConformities: any[]): GroupedNC[] => {
    const groups: { [key: string]: string[] } = {};
    if (!nonConformities) return [];

    nonConformities.forEach(nc => {
      const reason = nc.nao_conformidade_name || 'Outro';
      if (!groups[reason]) {
        groups[reason] = [];
      }
      nc.placas.forEach((p: string) => {
        const u = p.trim().toUpperCase();
        if (u && !groups[reason].includes(u)) {
          groups[reason].push(u);
        }
      });
    });

    return Object.keys(groups).map(reasonName => ({
      reasonName,
      plates: groups[reasonName]
    }));
  };

  // Get total plates count for a batch
  const getNonConconformitiesCount = (nonConformities: any[]): number => {
    if (!nonConformities) return 0;
    let total = 0;
    nonConformities.forEach(nc => {
      total += (nc.placas || []).length;
    });
    return total;
  };

  // Handle Generating notification with optional pre-selected recommended type
  const handleOpenGenerateModal = (pac: any, suggestedTypeId?: string) => {
    setGeneratingForPac(pac);
    setSelectedTypeId(suggestedTypeId || '');
    setNotificationNotes('');
    setSubmittingError(null);
  };

  // Rule Evaluator Engine
  const evaluateRuleForPac = (pac: any, loteAtual: any, ruleType: any): { type: any; isEscalated: boolean; reason: string } | null => {
    const rule = ruleType.rule;
    if (!rule || !rule.active) return null;

    const ruleValidadeMeses = rule.validadeMeses || 6;
    
    // Check if within X months
    const isWithinMonths = (dateValue: any, xMonths: number): boolean => {
      const date = getJsDate(dateValue);
      if (!date) return false;
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.4375);
      return diffMonths <= xMonths;
    };

    // Filter valid batches within X months
    const vBatches = pac.batches.filter((vb: any) => isWithinMonths(vb.periodoFinal, ruleValidadeMeses));

    const countPlatesForNc = (batch: any, ncId: string): number => {
      let c = 0;
      if (batch && batch.nonConformities) {
        batch.nonConformities.forEach((nc: any) => {
          if (!ncId || nc.nao_conformidade_id === ncId) {
            c += (nc.placas || []).length;
          }
        });
      }

      // 4. Regra de atraso na entrega de ensaios:
      // If the delay rule is enabled, the batch is marked as delivered out of deadline,
      // and we have at least the minimum number of late batches (rule.regraAtraso_limiteRepeticoes):
      if (rule.regraAtraso_ativa && batch && (batch.ensaioForaDoPrazo === true || batch.ensaioForaDoPrazo === 'true')) {
        const totalLate = vBatches.filter((vb: any) => vb.ensaioForaDoPrazo === true || vb.ensaioForaDoPrazo === 'true').length;
        const requiredMinRepetitions = rule.regraAtraso_limiteRepeticoes ?? 4;
        if (totalLate >= requiredMinRepetitions) {
          if (!ncId || (rule.regraAtraso_ncId && ncId === rule.regraAtraso_ncId)) {
            // Add 1 virtual non-conformity occurrence for this delay desvio
            c += 1;
          }
        }
      }
      return c;
    };

    // 2. Critério A: Lote Atual
    let triggerA = false;
    let pctA = 0;
    if (rule.criterioA_ativo && loteAtual) {
      const countA = countPlatesForNc(loteAtual, rule.criterioA_ncId);
      const totalA = loteAtual.numEnsaios || 1;
      pctA = (countA / totalA) * 100;
      triggerA = pctA >= (rule.criterioA_limite || 0);
    }

    // 3. Critério B: Soma de Lotes (Histórico)
    let triggerB = false;
    let pctB = 0;
    let sumPlatesB = 0;
    let sumEnsaiosB = 0;
    if (rule.criterioB_ativo) {
      vBatches.forEach((vb: any) => {
        sumPlatesB += countPlatesForNc(vb, rule.criterioB_ncId);
        sumEnsaiosB += (vb.numEnsaios || 0);
      });
      if (sumEnsaiosB > 0) {
        pctB = (sumPlatesB / sumEnsaiosB) * 100;
        triggerB = pctB >= (rule.criterioB_limite || 0);
      }
    }

    // 4. Operator logic combination
    let isTriggered = false;
    let criteriaReason = '';
    const ncNameA = rule.criterioA_ncId 
      ? (nonConformitiesConfigs.find(c => c.id === rule.criterioA_ncId)?.name || 'NC específica') 
      : 'Qualquer NC';
    const ncNameB = rule.criterioB_ncId 
      ? (nonConformitiesConfigs.find(c => c.id === rule.criterioB_ncId)?.name || 'NC específica') 
      : 'Qualquer NC';

    if (rule.criterioA_ativo && rule.criterioB_ativo) {
      if (rule.operadorLogico === 'E') {
        isTriggered = triggerA && triggerB;
        criteriaReason = `Critério A (${ncNameA}: ${pctA.toFixed(2)}% >= ${rule.criterioA_limite}%) E Critério B (Histórico ${ncNameB}: ${pctB.toFixed(2)}% >= ${rule.criterioB_limite}%) atingidos`;
      } else {
        isTriggered = triggerA || triggerB;
        criteriaReason = triggerA 
          ? `Critério A atingido (${ncNameA}: ${pctA.toFixed(2)}% >= ${rule.criterioA_limite}%)` 
          : `Critério B atingido (Histórico ${ncNameB}: ${pctB.toFixed(2)}% >= ${rule.criterioB_limite}%)`;
      }
    } else if (rule.criterioA_ativo) {
      isTriggered = triggerA;
      criteriaReason = `Critério A atingido (${ncNameA}: ${pctA.toFixed(2)}% >= ${rule.criterioA_limite}%)`;
    } else if (rule.criterioB_ativo) {
      isTriggered = triggerB;
      criteriaReason = `Critério B atingido (Histórico ${ncNameB}: ${pctB.toFixed(2)}% >= ${rule.criterioB_limite}%)`;
    }

    if (!isTriggered) return null;

    // 5. Escalonamento: Repeat limit check
    const sameTypeGeneratedCount = generatedNotifications.filter(n => 
      (n.pac_id === pac.id || n.pac_name === pac.name) && 
      n.notification_type_id === ruleType.id
    ).length;

    // Use specialized repetition limit check for delay rule if triggered by delay
    const isDelayActive = rule.regraAtraso_ativa && loteAtual && (loteAtual.ensaioForaDoPrazo === true || loteAtual.ensaioForaDoPrazo === 'true');
    const effectiveLimit = isDelayActive
      ? (rule.regraAtraso_limiteRepeticoes ?? rule.limiteNotificacoes ?? 2)
      : (rule.limiteNotificacoes ?? 2);

    if (sameTypeGeneratedCount >= effectiveLimit) {
      if (rule.proximoNivel_typeId) {
        const nextType = notificationTypes.find(t => t.id === rule.proximoNivel_typeId);
        if (nextType) {
          const nextEval = evaluateRuleForPac(pac, loteAtual, nextType);
          if (nextEval) {
            return {
              type: nextEval.type,
              isEscalated: true,
              reason: `Limite de "${ruleType.name}" atingido (${sameTypeGeneratedCount}/${effectiveLimit} emitidas). Escalonado para: "${nextEval.type.name}".`
            };
          } else {
            return {
              type: nextType,
              isEscalated: true,
              reason: `Limite de "${ruleType.name}" atingido (${sameTypeGeneratedCount}/${effectiveLimit} emitidas). Sugerido próximo nível: "${nextType.name}".`
            };
          }
        }
      }
    }

    return {
      type: ruleType,
      isEscalated: false,
      reason: criteriaReason
    };
  };

  const handleCreateNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generatingForPac || !selectedTypeId) {
      setSubmittingError("Por favor, selecione um tipo de notificação.");
      return;
    }

    setIsSavingNotification(true);
    setSubmittingError(null);

    const typeObj = notificationTypes.find(t => t.id === selectedTypeId);
    const typeName = typeObj ? typeObj.name : 'Notificação Genérica';

    const cleanBatches = generatingForPac.batches.map((b: any) => ({
      id: b.id,
      numEnsaios: b.numEnsaios || 0,
      totalNCs: getNonConconformitiesCount(b.nonConformities)
    }));

    const dateNow = new Date();

    const data = {
      pac_id: generatingForPac.id,
      pac_name: generatingForPac.name,
      notification_type_id: selectedTypeId,
      notification_type_name: typeName,
      notes: notificationNotes.trim(),
      batches: cleanBatches,
      createdAt: isLocalMode ? dateNow.toISOString() : serverTimestamp(),
      status: 'GERADA'
    };

    try {
      if (isLocalMode) {
        const localData = {
          ...data,
          id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
        };
        const updated = [localData, ...generatedNotifications];
        setGeneratedNotifications(updated);
        localStorage.setItem('lotes_notifications', JSON.stringify(updated));
      } else {
        await addDoc(collection(db, 'notifications'), data);
      }

      setNotificationSuccess(`Notificação do tipo "${typeName}" gerada com sucesso para o ${generatingForPac.name}!`);
      setGeneratingForPac(null);
      // Automatically clear toast after 4 seconds
      setTimeout(() => setNotificationSuccess(null), 4000);
    } catch (err: any) {
      if (isLocalMode) {
        setSubmittingError(`Erro local: ${err.message}`);
      } else {
        handleFirestoreError(err, 'CREATE', 'notifications');
        setSubmittingError(`Erro ao salvar no servidor: ${err.message}`);
      }
    } finally {
      setIsSavingNotification(false);
    }
  };

  const handleOpenViewingNotification = (item: any) => {
    const nType = notificationTypes.find(t => t.id === item.notification_type_id);
    
    // Default fallback templates
    const templates = nType?.templates || {
      oficio: {
        title: 'NOTIFICAÇÃO DE AUTUAÇÃO',
        processHeader: `Processo IPEM-PR 52603.000007/2026-31\nde ${formatDateShort(item.createdAt || new Date())}.`,
        intro: 'O Instituto de Pesos e Medidas do Paraná - IPEM-PR abriu um processo administrativo contra:',
        sections: [
          { id: '1', icon: 'search', title: 'MOTIVO', content: 'Identificamos irregularidades técnicas ou administrativas nos lotes sob vossa responsabilidade:\n\nRelação de Lotes Envolvidos:\n{lotes_detalhes}\n\nNo total acumulado, composto de {total_ensaios} ensaios, identificamos {erros_encontrados} desvios, o que corresponde a um percentual de irregularidade de {percentual_erro}%.\n\nRelação de placas com não-conformidades encontradas:\n{placas_nao_conformes}' },
          { id: '2', icon: 'check-square', title: 'COMO SE DEFENDER?', content: 'Você poderá apresentar a defesa por escrito em até 10(dez) dias, contados da data de recebimento desta notificação. Na defesa, informe:\n\n1. Nome do órgão que o notificou: IPEM-PR;\n2. Nome, CPF/CNPJ e assinatura;\n3. Número do Processo e do(s) Auto(s) de Infração;\n4. Motivo da defesa detalhado.' },
          { id: '3', icon: 'alert-triangle', title: 'IMPORTANTE', content: 'Você deve enviar uma cópia do seu documento de identificação oficial junto com a defesa. E se você estiver representado por procurador legal, não esqueça de encaminhar a procuração.' },
          { id: '4', icon: 'send', title: 'PARA ONDE ENVIAR?', content: 'Envie sua defesa para o IPEM-PR, localizado em Curitiba, na Rua Estados Unidos, 1354, bairro Bacacheri, CEP 82510-050.' },
          { id: '5', icon: 'help-circle', title: 'DÚVIDAS?', content: 'Envie e-mail para ouvidoria@ipem.pr.gov.br ou entre em contato pelo telefone (41) 3251-2200.' }
        ]
      },
      email: {
        subject: 'Notificação Urgente de Irregularidade - {razao_social}',
        body: 'Prezados,\n\nConstatamos não-conformidades nos lotes da empresa {razao_social}.\n\nDetalhes dos Lotes Envolvidos:\n{lotes_detalhes}\n\nEnquadramento Legal:\n{motivo_detalhes}\n\nReiteramos que o percentual de falhas detectadas foi de {percentual_erro}%. Verifique as instruções abaixo para apresentar a defesa prévia em até 10 dias corridos.\n\nAtenciosamente,\nIPEM-PR.'
      },
      whatsapp: {
        template: '⚠️ *NOTIFICAÇÃO DE AUTUAÇÃO - IPEM-PR*\n\nInformamos que foi aberto o processo administrativo para a empresa *{razao_social}* devido a desvios e atrasos encontrados nos ensaios.\n\n📦 *Lotes Envolvidos:*\n{lotes_detalhes}\n\n*Índice de Irregularidades:* {percentual_erro}% ({erros_encontrados} desvios de {total_ensaios} ensaios).\n\n📄 *Placas Não-Conformes:* \n{placas_nao_conformes}\n\n⚖️ *Como se defender?*\nVocê possui até 10 dias úteis para apresentar recurso formalizado por escrito para o IPEM-PR, contendo justificativas, documento de identificação e procuração (caso aplicável).\n\nDúvidas: ouvidoria@ipem.pr.gov.br ou (41) 3251-2200.'
      }
    };

    const notificationBatchesIds = (item.batches || []).map((b: any) => b.id);
    const fullBatches = batchesWithNCs.filter(b => notificationBatchesIds.includes(b.id));

    let totalEnsaios = 0;
    const nonConformingPlates: string[] = [];
    const groundsUnique = new Set<string>();

    const formatDate = (ts: any) => {
      if (!ts) return 'N/A';
      if (typeof ts.toDate === 'function') {
        return ts.toDate().toLocaleDateString('pt-BR');
      }
      if (ts instanceof Date) {
        return ts.toLocaleDateString('pt-BR');
      }
      if (ts.seconds) {
        return new Date(ts.seconds * 1000).toLocaleDateString('pt-BR');
      }
      if (typeof ts === 'string' || typeof ts === 'number') {
        return new Date(ts).toLocaleDateString('pt-BR');
      }
      return 'N/A';
    };

    const lotesList: string[] = [];

    fullBatches.forEach(b => {
      totalEnsaios += (b.numEnsaios || 0);
      const ncs = b.nonConformities || [];
      ncs.forEach((nc: any) => {
        groundsUnique.add(nc.nao_conformidade_name);
        (nc.placas || []).forEach((p: string) => {
          nonConformingPlates.push(`${p.trim().toUpperCase()} (${nc.nao_conformidade_name})`);
        });
      });

      const isAtrasado = b.ensaioForaDoPrazo === true || b.ensaioForaDoPrazo === 'true';
      if (isAtrasado) {
        groundsUnique.add(`Atraso na entrega de ensaios (Período: ${formatDate(b.periodoInicial)} a ${formatDate(b.periodoFinal)} | Nº de ensaios: ${b.numEnsaios || 0})`);
      }

      const isIrregular = isAtrasado || ncs.length > 0;
      if (isIrregular) {
        const pInicial = formatDate(b.periodoInicial);
        const pFinal = formatDate(b.periodoFinal);
        const dataRecebimento = formatDate(b.recebidoEm);
        const nEnsaios = b.numEnsaios || 0;

        let situacaoDet = '';
        if (isAtrasado) {
          situacaoDet = 'Entrega fora do prazo (Irregularidade administrativa no conjunto do lote)';
        }
        if (ncs.length > 0) {
          const platesList: string[] = [];
          ncs.forEach((nc: any) => {
            if (nc.placas && nc.placas.length > 0) {
              platesList.push(`${nc.nao_conformidade_name} (Placas: ${nc.placas.join(', ').toUpperCase()})`);
            } else {
              platesList.push(`${nc.nao_conformidade_name}`);
            }
          });
          const platesStr = platesList.join('; ');
          situacaoDet = situacaoDet 
            ? `${situacaoDet} e desvios técnicos: ${platesStr}`
            : `Desvios técnicos detectados: ${platesStr}`;
        }

        lotesList.push(
          `• Lote de Referência: ${b.id}\n` +
          `  - Período do Lote: ${pInicial} a ${pFinal}\n` +
          `  - Número de Ensaios do Lote: ${nEnsaios}\n` +
          `  - Data do Recebimento do Lote: ${dataRecebimento}\n` +
          `  - Descrição da Irregularidade: ${situacaoDet}`
        );
      }
    });

    const lotesDetalhesString = lotesList.length > 0 
      ? lotesList.join('\n\n') 
      : '(Nenhum lote irregular ou entregue fora do prazo foi identificado para este PAC)';

    const pacObj = pacs.find(p => p.id === item.pac_id || p.name === item.pac_name);
    const pacRazaoSocial = pacObj ? pacObj.name : (item.pac_name || '');
    const pacCNPJ = pacObj ? pacObj.cnpj : '02.943.486/0001-70';

    const errosEncontrados = nonConformingPlates.length;
    const percentualErro = totalEnsaios > 0 ? ((errosEncontrados / totalEnsaios) * 100).toFixed(2) : '0.00';
    const platesJoinedFormatted = nonConformingPlates.join(', ') || '(Nenhuma placa encontrada)';
    const reasonsJoinedFormatted = Array.from(groundsUnique).join(', ') || 'Nenhum desvio específico';

    const compilePlaceholders = (text: string) => {
      if (!text) return '';
      return text
        .replace(/{pac_name}/g, item.pac_name || '')
        .replace(/{razao_social}/g, pacRazaoSocial)
        .replace(/{cnpj}/g, pacCNPJ)
        .replace(/{total_ensaios}/g, String(totalEnsaios))
        .replace(/{erros_encontrados}/g, String(errosEncontrados))
        .replace(/{percentual_erro}/g, percentualErro)
        .replace(/{placas_nao_conformes}/g, platesJoinedFormatted)
        .replace(/{motivo_detalhes}/g, reasonsJoinedFormatted)
        .replace(/{lotes_detalhes}/g, lotesDetalhesString)
        .replace(/{data_atual}/g, formatDateShort(item.createdAt || new Date()));
    };

    if (item.customOficioTitle !== undefined) {
      setEditableOficioTitle(item.customOficioTitle || '');
      setEditableOficioProcess(item.customOficioProcess || '');
      setEditableOficioIntro(item.customOficioIntro || '');
      setEditableOficioSections(item.customOficioSections || []);
      setEditableEmailSubject(item.customEmailSubject || '');
      setEditableEmailBody(item.customEmailBody || '');
      setEditableWhatsapp(item.customWhatsapp || '');
    } else {
      setEditableOficioTitle(compilePlaceholders(templates.oficio?.title || 'NOTIFICAÇÃO DE AUTUAÇÃO'));
      setEditableOficioProcess(compilePlaceholders(templates.oficio?.processHeader || 'Processo IMETRO-SC'));
      setEditableOficioIntro(compilePlaceholders(templates.oficio?.intro || ''));
      setEditableOficioSections(
        (templates.oficio?.sections || []).map((s: any) => ({
          ...s,
          title: compilePlaceholders(s.title),
          content: compilePlaceholders(s.content)
        }))
      );

      setEditableEmailSubject(compilePlaceholders(templates.email?.subject || ''));
      setEditableEmailBody(compilePlaceholders(templates.email?.body || ''));
      setEditableWhatsapp(compilePlaceholders(templates.whatsapp?.template || ''));
    }

    setViewingNotificationNotes(item.notes || '');
    setViewingNotification(item);
    setPreviewChannel('oficio');
  };

  const handleSaveRectification = async () => {
    if (!viewingNotification) return;

    setIsSavingNotification(true);
    try {
      const updatedItem = {
        ...viewingNotification,
        notes: viewingNotificationNotes.trim(),
        customOficioTitle: editableOficioTitle,
        customOficioProcess: editableOficioProcess,
        customOficioIntro: editableOficioIntro,
        customOficioSections: editableOficioSections,
        customEmailSubject: editableEmailSubject,
        customEmailBody: editableEmailBody,
        customWhatsapp: editableWhatsapp,
        rectifiedAt: isLocalMode ? new Date().toISOString() : serverTimestamp(),
        status: 'RETIFICADA'
      };

      if (isLocalMode) {
        const updated = generatedNotifications.map(n => n.id === viewingNotification.id ? updatedItem : n);
        setGeneratedNotifications(updated);
        localStorage.setItem('lotes_notifications', JSON.stringify(updated));
      } else {
        const docRef = doc(db, 'notifications', viewingNotification.id);
        const { id, ...saveData } = updatedItem;
        
        const cleanSaveData = {
          ...saveData,
          rectifiedAt: serverTimestamp()
        };
        await updateDoc(docRef, cleanSaveData);
        
        setGeneratedNotifications(prev => prev.map(n => n.id === viewingNotification.id ? updatedItem : n));
      }

      setViewingNotification(updatedItem);
      setNotificationSuccess("Notificação retificada e salva com sucesso!");
      setTimeout(() => setNotificationSuccess(null), 3500);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao retificar notificação: " + err.message);
    } finally {
      setIsSavingNotification(false);
    }
  };

  const confirmDeleteNotification = async (notifId: string) => {
    try {
      if (isLocalMode) {
        const updated = generatedNotifications.filter(n => n.id !== notifId);
        setGeneratedNotifications(updated);
        localStorage.setItem('lotes_notifications', JSON.stringify(updated));
      } else {
        await deleteDoc(doc(db, 'notifications', notifId));
        setGeneratedNotifications(prev => prev.filter(n => n.id !== notifId));
      }
      setNotificationSuccess("Notificação excluída com sucesso.");
      setTimeout(() => setNotificationSuccess(null), 3000);
      
      if (viewingNotification && viewingNotification.id === notifId) {
        setViewingNotification(null);
      }
    } catch (err: any) {
      console.error(err);
      alert("Erro ao excluir notificação: " + err.message);
    }
  };

  const handleCopyViewingText = () => {
    let text = '';
    if (previewChannel === 'oficio') {
      const header = editableOficioTitle + '\n' + editableOficioProcess + '\n\n' + editableOficioIntro + '\n\n';
      const sections = editableOficioSections.map(s => `[${s.title}]\n${s.content}`).join('\n\n');
      text = header + sections;
    } else if (previewChannel === 'email') {
      text = `Assunto: ${editableEmailSubject}\n\n${editableEmailBody}`;
    } else {
      text = editableWhatsapp;
    }
    navigator.clipboard.writeText(text);
    setCopiedPreviewSuccess(true);
    setTimeout(() => setCopiedPreviewSuccess(false), 2000);
  };

  const handlePrintViewingPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const getIconEmoji = (iconId: string) => {
      const mapping: { [key: string]: string } = {
        'search': '🔍',
        'check-square': '☑️',
        'alert-triangle': '⚠️',
        'send': '✉️',
        'help-circle': '❓',
        'file-text': '📄',
        'mail': '✉️',
        'message-square': '💬',
        'phone': '📞',
        'info': 'ℹ️'
      };
      return mapping[iconId] || '📄';
    };

    const sectionsHTML = editableOficioSections.map(s => {
      const formattedContent = (s.content || '').replace(/\n/g, '<br/>');
      return `
        <div class="section-item" style="display: flex; margin-bottom: 24px; font-family: sans-serif; page-break-inside: avoid; break-inside: avoid;">
          <div style="flex: 0 0 60px; text-align: center; border-right: 1px solid #e2e8f0; margin-right: 20px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 5px;">
            <div style="background-color: #f1f5f9; padding: 12px; border-radius: 12px; color: #475569; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; border: 1px solid #e2e8f0;">
              ${getIconEmoji(s.icon)}
            </div>
            <div style="width: 2px; flex: 1; min-height: 20px; background-color: #f1f5f9; margin-top: 10px;"></div>
          </div>
          <div style="flex: 1; padding: 16px 20px; background-color: #f8fafc; border-radius: 16px; border: 1px solid #f1f5f9;">
            <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; letter-spacing: 0.1em; color: #1e293b; text-transform: uppercase;">${s.title}</h4>
            <p style="margin: 0; font-size: 13px; font-weight: 400; line-height: 1.6; color: #475569;">${formattedContent}</p>
          </div>
        </div>
      `;
    }).join('');

    const activeSignature = (signatures || []).find((sig: any) => sig.id === selectedSignatureId);

    const signatureHTML = activeSignature ? `
      <div style="margin-top: 45px; display: flex; flex-direction: column; align-items: center; text-align: center; page-break-inside: avoid; break-inside: avoid; font-family: sans-serif;">
        <div style="height: 60px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px;">
          <img src="${activeSignature.imageUrl}" style="max-height: 55px; max-width: 180px; object-fit: contain;" />
        </div>
        <div style="font-size: 12px; font-weight: bold; color: #1e293b; border-top: 1px solid #cbd5e1; padding-top: 6px; width: 260px; font-family: Arial, sans-serif;">
          ${activeSignature.name}
        </div>
        <div style="font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 3px; font-weight: bold;">
          ${activeSignature.role}
        </div>
      </div>
    ` : '';

    printWindow.document.write(`
      <html>
        <head>
          <title>${editableOficioTitle} - ${viewingNotification?.pac_name}</title>
          <style>
            @media print {
              body { 
                margin: 2.2cm 1.8cm; 
                -webkit-print-color-adjust: exact; 
                padding-bottom: 50px; 
                display: block !important;
              }
              .no-print { display: none !important; }
              .section-item, .print-avoid-break, .target-box { 
                page-break-inside: avoid !important; 
                break-inside: avoid !important; 
              }
              .header {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .page-footer {
                position: fixed;
                bottom: 0px;
                left: 0;
                right: 0;
                display: flex !important;
                justify-content: space-between;
                align-items: center;
                border-top: 1px solid #cbd5e1;
                padding-top: 8px;
                font-size: 9px;
                color: #64748b;
                font-family: Arial, sans-serif;
              }
              .page-footer::after {
                counter-increment: page;
                content: "Página " counter(page);
              }
            }
            body { 
              font-family: Arial, Helvetica, sans-serif;
              color: #1e293b;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
              line-height: 1.5;
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .title-section {
              text-align: right;
            }
            .title-section h1 {
              font-size: 20px;
              font-weight: 900;
              margin: 0;
              letter-spacing: 0.05em;
              color: #0f172a;
            }
            .process-badge {
              background-color: #f1f5f9;
              padding: 12px 16px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: bold;
              line-height: 1.4;
              margin-top: 10px;
              border: 1px solid #e2e8f0;
              display: inline-block;
              text-align: left;
            }
            .logos {
              display: flex;
              gap: 15px;
              align-items: center;
            }
            .target-box {
              background-color: #f1f5f9;
              border-radius: 16px;
              padding: 16px 20px;
              margin-bottom: 30px;
              font-size: 14px;
              border: 1px solid #e2e8f0;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .action-bar {
              text-align: center;
              padding: 20px;
              margin-top: 40px;
            }
            .print-btn {
              background-color: #5A5A40;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 10px;
              font-weight: bold;
              cursor: pointer;
            }
          </style>
        </head>
        <body>
          <div class="no-print action-bar">
            <button class="print-btn" onclick="window.print()">Imprimir / Salvar como PDF</button>
          </div>
          
          <div class="header">
            <div class="logos" style="display: flex; align-items: center; gap: 12px;">
              ${logoUrl ? `<img src="${logoUrl}" style="max-height: 50px; width: auto; object-fit: contain;" />` : `<span style="font-size: 20px; font-weight: bold; color: #5A5A40; border: 2.5px solid #5A5A40; padding: 4px 10px; border-radius: 8px;">IPEM-PR</span>`}
              <div style="font-size: 9px; line-height: 1.2; font-weight: bold; color: #475569;">
                Órgão Delegado / Conveniado<br/>
                IPEM-PR
              </div>
            </div>
            <div class="title-section">
              <h1>${editableOficioTitle}</h1>
              <div class="process-badge">
                ${editableOficioProcess.replace(/\\n/g, '<br/>').replace(/\n/g, '<br/>')}
              </div>
            </div>
          </div>

          <div style="font-size: 14px; color: #475569; margin-bottom: 30px; font-weight: 500;">
            ${editableOficioIntro}
          </div>

          <div class="target-box print-avoid-break">
            <strong>EMPRESA NOTIFICADA:</strong> ${viewingNotification?.pac_name}<br/>
            <strong>CNPJ/ID:</strong> 02.943.486/0001-70
          </div>

          <div class="sections-container">
            ${sectionsHTML}
          </div>

          ${signatureHTML}

          <div style="margin-top: 60px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 20px; page-break-inside: avoid; break-inside: avoid;">
            Documento gerado eletronicamente pelo Sistema de Recebimento de Lotes IPEM-PR.
          </div>

          <div class="page-footer" style="display: none;">
            <span>IPEM-PR • Sistema Lotes • Documento Autenticado</span>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleEditableSectionTitleChange = (id: string, val: string) => {
    setEditableOficioSections(prev => prev.map(s => s.id === id ? { ...s, title: val } : s));
  };

  const handleEditableSectionContentChange = (id: string, val: string) => {
    setEditableOficioSections(prev => prev.map(s => s.id === id ? { ...s, content: val } : s));
  };

  const handleEditableSectionIconChange = (id: string, iconId: string) => {
    setEditableOficioSections(prev => prev.map(s => s.id === id ? { ...s, icon: iconId } : s));
  };

  const toggleHistory = (pacId: string) => {
    setExpandedPacHistory(prev => ({
      ...prev,
      [pacId]: !prev[pacId]
    }));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Toast Success Message */}
      {notificationSuccess && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#5A5A40] text-white py-3 px-6 rounded-2xl shadow-2xl flex items-center gap-3 border border-[#f5f5f0]/10 animate-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 size={20} className="text-lime-400" />
          <span className="text-sm font-medium">{notificationSuccess}</span>
          <button onClick={() => setNotificationSuccess(null)} className="ml-2 hover:opacity-80">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-[24px] border border-[#e5e5e0] flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#5A5A40]/70">PACs Pendentes</p>
            <h3 className="text-2xl font-bold text-[#1a1a1a] mt-0.5">{pacsWithNC.length}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[24px] border border-[#e5e5e0] flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#5A5A40]/70">Lotes c/ Não-Conformidade</p>
            <h3 className="text-2xl font-bold text-[#1a1a1a] mt-0.5">{totalNCBatchesCount}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[24px] border border-[#e5e5e0] flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Bell size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#5A5A40]/70">Notificações Geradas</p>
            <h3 className="text-2xl font-bold text-[#1a1a1a] mt-0.5">{totalGeneratedNotificationsCount}</h3>
          </div>
        </div>
      </div>

      {/* Sub-tabs Selector */}
      <div className="flex border-b border-[#e5e5e0] gap-6 mt-2">
        <button
          onClick={() => setActiveSubTab('pending')}
          className={cn(
            "pb-3 text-sm font-bold uppercase tracking-wider relative transition-all border-b-2",
            activeSubTab === 'pending'
              ? "border-[#5A5A40] text-[#5A5A40]"
              : "border-transparent text-[#5A5A40]/40 hover:text-[#5A5A40]/85"
          )}
        >
          PACs Pendentes ({pacsWithNC.length})
        </button>
        <button
          onClick={() => setActiveSubTab('history')}
          className={cn(
            "pb-3 text-sm font-bold uppercase tracking-wider relative transition-all border-b-2",
            activeSubTab === 'history'
              ? "border-[#5A5A40] text-[#5A5A40]"
              : "border-transparent text-[#5A5A40]/40 hover:text-[#5A5A40]/85"
          )}
        >
          Notificações Geradas ({generatedNotifications.length})
        </button>
      </div>

      {activeSubTab === 'pending' ? (
        <>
          {/* Main Panel Description */}
          <div className="bg-white p-6 rounded-[24px] border border-[#e5e5e0]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#5A5A40]">Acompanhamento de Não-Conformidades</h3>
                <p className="text-xs text-[#5A5A40]/60">Gere notificações oficiais de irregularidades baseadas em não-conformidades encontradas durante os ensaios de cada PAC.</p>
              </div>
            </div>
          </div>

          {/* PAC Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pacsWithNC.map(pac => {
              const pacHistory = generatedNotifications.filter(n => n.pac_id === pac.id || n.pac_name === pac.name);
              const activeHistory = expandedPacHistory[pac.id] || false;

              // Find the "lote atual" (latest batch by periodoFinal)
              const sortedBatches = [...pac.batches].sort((a, b) => {
                const dateA = getJsDate(a.periodoFinal)?.getTime() || 0;
                const dateB = getJsDate(b.periodoFinal)?.getTime() || 0;
                return dateB - dateA;
              });
              const loteAtual = sortedBatches[0];

              // Evaluate each active rule to find the best recommendation matching the criteria
              const getRecommendation = () => {
                let bestSuggestion: { type: any; isEscalated: boolean; reason: string } | null = null;
                for (const nType of notificationTypes) {
                  if (nType.rule && nType.rule.active) {
                    const evalResult = evaluateRuleForPac(pac, loteAtual, nType);
                    if (evalResult) {
                      bestSuggestion = evalResult;
                      break;
                    }
                  }
                }
                return bestSuggestion;
              };

              const recommendation = getRecommendation();

              return (
                <div key={pac.id} className="bg-white rounded-[32px] border border-[#e5e5e0] overflow-hidden flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
                  
                  {/* Header */}
                  <div className="p-6 border-b border-[#e5e5e0] bg-[#f5f5f0]/30 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="font-display font-bold text-lg text-[#1a1a1a]">{pac.name}</h4>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center bg-red-100 text-red-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                          {pac.batches.length} {pac.batches.length === 1 ? 'lote com desvio' : 'lotes com desvios'}
                        </span>
                      </div>
                    </div>
                    
                    {recommendation ? (
                      <button
                        onClick={() => handleOpenGenerateModal(pac, recommendation.type.id)}
                        className="bg-amber-600 hover:bg-amber-700 text-white transition-colors py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm"
                      >
                        <Sparkles size={14} />
                        GERAR RECOMENDADA
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenGenerateModal(pac)}
                        className="bg-[#5A5A40] text-white hover:bg-[#4a4a30] transition-colors py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm"
                      >
                        <Bell size={14} />
                        GERAR NOTIFICAÇÃO
                      </button>
                    )}
                  </div>

                  {/* Batches list */}
                  <div className="p-6 space-y-4 flex-1">
                    {/* Embedded Recommendation Indicator */}
                    {recommendation && (
                      <div className="bg-amber-50/50 border border-amber-200/50 p-4 rounded-2xl flex items-start gap-3 mb-4">
                        <div className="p-2 bg-amber-100 text-amber-700 rounded-xl mt-0.5">
                          <Sparkles size={16} />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-800">
                              Recomendação Inteligente de Autuação
                            </span>
                            {recommendation.isEscalated && (
                              <span className="text-[8px] uppercase font-mono font-bold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
                                Regra De Escalonamento Ativa
                              </span>
                            )}
                          </div>
                          <h5 className="text-xs font-bold text-gray-900 leading-snug">
                            Sugerido: <span className="underline decoration-amber-500 font-extrabold">{recommendation.type.name}</span>
                          </h5>
                          <p className="text-[10px] text-gray-600 leading-normal">
                            {recommendation.reason}
                          </p>
                          <button
                            onClick={() => handleOpenGenerateModal(pac, recommendation.type.id)}
                            className="mt-2 text-[10px] font-semibold text-amber-950 bg-amber-100/80 hover:bg-amber-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors uppercase tracking-wider border border-amber-200"
                          >
                            <Check size={12} />
                            Aplicar Sugestão & Gerar
                          </button>
                        </div>
                      </div>
                    )}

                    <p className="text-xs font-bold uppercase text-[#5A5A40]/70 tracking-wider">Lotes Vinculados</p>
                    
                    <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                      {pac.batches.map((batch: any) => {
                        const totalNCs = getNonConconformitiesCount(batch.nonConformities);
                        const totalEnsaios = batch.numEnsaios || 0;
                        const percentage = totalEnsaios > 0 
                          ? ((totalNCs / totalEnsaios) * 100).toFixed(2) 
                          : '0.00';

                        return (
                          <div key={batch.id} className="p-4 bg-[#f5f5f0]/40 rounded-2xl border border-[#e5e5e0]/70 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-gray-500 font-mono">
                                  P: {formatDateShort(batch.periodoInicial)} - {formatDateShort(batch.periodoFinal)}
                                </span>
                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#5A5A40]/10 text-[#5A5A40]">
                                  {batch.status}
                                </span>
                                {batch.ensaioForaDoPrazo && (
                                  <span className="flex items-center gap-1 text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                                    <Sparkles size={10} className="text-amber-600 animate-pulse" /> ENSAIO FORA DO PRAZO
                                  </span>
                                )}
                              </div>
                              
                              {/* Percentage Indicators */}
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-xs text-[#5A5A40]">
                                  <span className="font-semibold text-red-600">{percentage}% Não-Conformidade</span>
                                  <span className="text-gray-400">({totalNCs} desvios em {totalEnsaios} ensaios)</span>
                                </div>
                                {/* Simple thin progress bar */}
                                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                  <div 
                                    className="bg-red-500 h-full rounded-full" 
                                    style={{ width: `${Math.min(Number(percentage), 100)}%` }} 
                                  />
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => setSelectedBatchForDetails(batch)}
                              className="px-4 py-2 text-xs font-bold bg-white border border-[#e5e5e0] hover:bg-[#f5f5f0] text-[#5A5A40] rounded-xl self-end sm:self-center transition-colors shadow-sm"
                            >
                              Detalhar
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Collapsible History Section */}
                  <div className="border-t border-[#e5e5e0] bg-gray-50/50">
                    <button
                      onClick={() => toggleHistory(pac.id)}
                      className="w-full p-4 flex items-center justify-between text-xs font-bold uppercase text-[#5A5A40]/70 hover:bg-gray-100/50 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <History size={14} className="text-[#5A5A40]" />
                        Histórico de Notificações ({pacHistory.length})
                      </span>
                      {activeHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {activeHistory && (
                      <div className="p-4 bg-white border-t border-[#e5e5e0] space-y-3 max-h-[220px] overflow-y-auto animate-in slide-in-from-top-2 duration-200">
                        {pacHistory.length === 0 ? (
                          <p className="text-xs text-gray-400 italic text-center py-4">Nenhuma notificação gerada para este PAC.</p>
                        ) : (
                          pacHistory.map((item: any) => (
                            <div key={item.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2 text-xs">
                              <div className="flex justify-between items-start gap-2">
                                <div className="space-y-0.5">
                                  <span className="font-bold text-gray-800 uppercase block">{item.notification_type_name}</span>
                                  <span className="text-[10px] text-gray-400 font-mono block">{formatDateTime(item.createdAt)}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleOpenViewingNotification(item)}
                                  className="text-[10px] font-bold text-white bg-[#5A5A40] hover:bg-[#4a4a30] py-1 px-3 rounded-lg transition-all shadow-sm"
                                >
                                  Visualizar & Exportar
                                </button>
                              </div>
                              
                              {item.notes && (
                                <p className="text-[#5A5A40] leading-relaxed bg-white p-2 rounded-lg border border-gray-100">
                                  <strong>Obs:</strong> {item.notes}
                                </p>
                              )}
                              
                              <div className="text-[10px] text-gray-400">
                                Lotes inclusos: {item.batches?.length || 0} (Ensaios abrangidos: {item.batches?.reduce((acc: number, b: any) => acc + (b.numEnsaios || 0), 0) || 0})
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                </div>
              );
            })}

            {pacsWithNC.length === 0 && (
              <div className="col-span-full text-center py-24 bg-white rounded-[40px] border border-dashed border-[#e5e5e0]">
                <Bell size={48} className="mx-auto mb-4 text-[#5A5A40]/30" />
                <h4 className="text-lg font-display font-medium text-[#5A5A40] mb-1">Nenhum PAC com não-conformidades ativas</h4>
                <p className="text-xs text-[#5A5A40]/60 max-w-sm mx-auto">Parabéns! Todos os lançamentos de lotes estão totalmente conformes e revisados no momento.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Section: History Tab & General Notification Central */}
          <div className="bg-white p-6 rounded-[24px] border border-[#e5e5e0] space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#5A5A40]">Central de Notificações Enviadas</h3>
                <p className="text-xs text-[#5A5A40]/60">Consulte, retifique ou exclua qualquer notificação administrativa que já foi gerada pelo sistema.</p>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text"
                  placeholder="Buscar PAC, tipo ou assunto..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[#f5f5f0] border-none rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/10"
                  value={notifSearch}
                  onChange={e => setNotifSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Table or Responsive Cards list of all generated notifications */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {generatedNotifications.filter(n => {
              if (!notifSearch) return true;
              const matchPac = n.pac_name?.toLowerCase().includes(notifSearch.toLowerCase());
              const matchType = n.notification_type_name?.toLowerCase().includes(notifSearch.toLowerCase());
              const matchNotes = n.notes?.toLowerCase().includes(notifSearch.toLowerCase());
              return matchPac || matchType || matchNotes;
            }).map(item => {
              const dateCreated = getJsDate(item.createdAt);
              const formattedDate = dateCreated ? format(dateCreated, "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-';
              
              return (
                <div key={item.id} className="bg-white p-6 rounded-[24px] border border-[#e5e5e0] relative hover:shadow-lg transition-all group flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-bold text-[#5A5A40] opacity-50 block uppercase tracking-wider">PAC Notificado</span>
                        <h4 className="text-lg font-bold text-gray-900 tracking-tight mt-0.5">{item.pac_name}</h4>
                      </div>
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase bg-sky-50 text-sky-700 tracking-wide border border-sky-200/50",
                        item.status === 'RETIFICADA' && "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {item.status || item.notification_type_name || 'Autuação'}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2 text-xs">
                      <div className="flex justify-between border-b border-gray-100 pb-1.5">
                        <span className="text-gray-400 font-medium">Tipo:</span>
                        <span className="font-bold text-[#5A5A40]">{item.notification_type_name}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-100 pb-1.5">
                        <span className="text-gray-400 font-medium">Gerada Em:</span>
                        <span className="font-mono text-gray-600">{formattedDate}</span>
                      </div>
                      {item.rectifiedAt && (
                        <div className="flex justify-between border-b border-gray-100 pb-1.5 text-amber-750">
                          <span className="font-medium">Retificada Em:</span>
                          <span className="font-bold font-mono text-amber-600">{formatDateShort(item.rectifiedAt)}</span>
                        </div>
                      )}
                      
                      {item.notes && (
                        <div className="bg-gray-50/70 p-2.5 rounded-xl border border-gray-100 mt-3 text-[11px] leading-relaxed italic text-gray-600">
                          <strong className="block text-[8px] font-extrabold uppercase text-gray-400 tracking-wider font-sans not-italic mb-0.5">Observações:</strong>
                          "{item.notes}"
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-6 pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => handleOpenViewingNotification(item)}
                      className="flex-1 py-2 rounded-xl bg-[#5A5A40]/5 hover:bg-[#5A5A40]/10 text-[#5A5A40] text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <Eye size={13} />
                      Consultar & Retificar
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifToDelete(item.id)}
                      className="p-2 rounded-xl hover:bg-rose-50 text-rose-500 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100"
                      title="Excluir Notificação"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            {generatedNotifications.filter(n => {
              if (!notifSearch) return true;
              const matchPac = n.pac_name?.toLowerCase().includes(notifSearch.toLowerCase());
              const matchType = n.notification_type_name?.toLowerCase().includes(notifSearch.toLowerCase());
              const matchNotes = n.notes?.toLowerCase().includes(notifSearch.toLowerCase());
              return matchPac || matchType || matchNotes;
            }).length === 0 && (
              <div className="col-span-full text-center py-20 bg-white rounded-[32px] border border-dashed border-[#e5e5e0] flex flex-col items-center justify-center">
                <BellOff className="text-gray-300 mb-4" size={48} />
                <h4 className="font-bold text-gray-900">Nenhuma notificação encontrada</h4>
                <p className="text-xs text-gray-500 mt-1">Nenhuma notificação com base no filtro ou histórico cadastrado no sistema.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Batch Details Modal */}
      {selectedBatchForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-[#e5e5e0] flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-xl text-[#5A5A40]">Não-Conformidades do Lote</h3>
                <p className="text-xs text-[#5A5A40]/60 mt-1">
                  PAC: {selectedBatchForDetails.pac} • Recebido por {selectedBatchForDetails.recebidoPor}
                </p>
              </div>
              <button 
                onClick={() => setSelectedBatchForDetails(null)} 
                className="p-2 hover:bg-[#f5f5f0] rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              
              {/* Batch Metrics */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-[#f5f5f0]/40 rounded-2xl border border-[#e5e5e0]/50 text-center">
                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-400">Total de Ensaios</p>
                  <p className="text-lg font-bold text-gray-800">{selectedBatchForDetails.numEnsaios}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-400 font-mono">Não-Conformidades</p>
                  <p className="text-lg font-bold text-red-600">
                    {getNonConconformitiesCount(selectedBatchForDetails.nonConformities)} PLACAS
                  </p>
                </div>
              </div>

              {/* Grouped nonconformity list */}
              {selectedBatchForDetails.ensaioForaDoPrazo && (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 flex items-start gap-2.5">
                  <Sparkles size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-left w-full">
                    <p className="text-xs font-bold uppercase tracking-wide">Entrega realizada fora do prazo</p>
                    <p className="text-[11px] text-amber-800 leading-normal">
                      Este lote foi expressamente assinalado como "ensaio fora do prazo" durante a conferência, caracterizando uma irregularidade administrativa aplicável para fins de notificação.
                    </p>
                    <div className="mt-2 pt-2 border-t border-amber-200/50 grid grid-cols-3 gap-2 text-[10px] font-bold text-amber-950 font-mono">
                      <div>
                        <div className="text-[8px] uppercase tracking-wider text-amber-800/70 font-sans font-semibold">Período Inicial</div>
                        <div>{formatDateShort(selectedBatchForDetails.periodoInicial)}</div>
                      </div>
                      <div>
                        <div className="text-[8px] uppercase tracking-wider text-amber-800/70 font-sans font-semibold">Período Final</div>
                        <div>{formatDateShort(selectedBatchForDetails.periodoFinal)}</div>
                      </div>
                      <div>
                        <div className="text-[8px] uppercase tracking-wider text-amber-800/70 font-sans font-semibold">Nº de Ensaios</div>
                        <div>{selectedBatchForDetails.numEnsaios || 0}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <p className="text-xs font-bold uppercase text-[#5A5A40]/70 tracking-wider">Detalhamento dos Desvios (Agrupados por Motivo)</p>
                
                <div className="space-y-3">
                  {getGroupedNonConformities(selectedBatchForDetails.nonConformities).map((group, index) => (
                    <div key={index} className="p-4 bg-white rounded-2xl border border-gray-200 flex flex-col gap-2 shadow-sm">
                      <div className="text-xs text-gray-500 font-mono font-bold leading-relaxed">
                        Placas: <span className="text-red-600 bg-red-50 py-1 px-2 rounded-lg inline-block border border-red-100">{group.plates.join(', ')}</span>
                      </div>
                      <div className="text-sm font-bold text-[#5A5A40] flex items-center gap-1.5 mt-1">
                        <Info size={14} className="text-gray-400" />
                        Motivo: {group.reasonName}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="p-6 bg-gray-50 border-t border-[#e5e5e0] flex justify-end">
              <button
                onClick={() => setSelectedBatchForDetails(null)}
                className="px-6 py-2.5 bg-[#5A5A40] hover:bg-[#4a4a30] text-white font-bold rounded-2xl text-sm transition-colors"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Notification Modal */}
      {generatingForPac && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <form onSubmit={handleCreateNotification}>
              
              <div className="p-6 border-b border-[#e5e5e0] flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-xl text-[#5A5A40]">Gerar Notificação PAC</h3>
                  <p className="text-xs text-red-600 font-semibold mt-1 uppercase tracking-wider">
                    Destinatário: {generatingForPac.name}
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => setGeneratingForPac(null)} 
                  className="p-2 hover:bg-[#f5f5f0] rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                
                {submittingError && (
                  <div className="bg-red-50 border border-red-100 text-red-700 p-3 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>{submittingError}</span>
                  </div>
                )}

                {/* Notification Type select */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-[#5A5A40]/70">Tipo de Notificação</label>
                  {notificationTypes.length === 0 ? (
                    <div className="p-4 bg-amber-50 border border-amber-100 text-amber-800 rounded-xl text-xs space-y-1">
                      <p className="font-bold">Nenhum tipo de notificação cadastrado!</p>
                      <p>Vá até a tela "Configurações" &gt; "Tipos de Notificações" para adicionar antes de continuar.</p>
                    </div>
                  ) : (
                    <select
                      required
                      className="w-full p-3 bg-white border border-[#e5e5e0] rounded-xl focus:ring-2 focus:ring-[#5A5A40]/20 text-sm"
                      value={selectedTypeId}
                      onChange={e => setSelectedTypeId(e.target.value)}
                    >
                      <option value="">Selecione o tipo oficial...</option>
                      {notificationTypes.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Covered Batches Summary info */}
                <div className="space-y-2 bg-[#f5f5f0]/50 p-4 rounded-xl border border-[#e5e5e0]/50">
                  <span className="text-[10px] font-bold uppercase text-gray-500">Lotes Abrangidos por esta Notificação:</span>
                  <div className="space-y-2 mt-1 text-xs text-[#5A5A40]">
                    {generatingForPac.batches.map((b: any, index: number) => (
                      <div key={b.id || index} className="flex flex-col gap-1 py-1.5 border-b border-gray-250/20 last:border-0 font-mono">
                        <div className="flex justify-between">
                          <span>Lote ({formatDateShort(b.periodoInicial)} - {formatDateShort(b.periodoFinal)})</span>
                          <span className="font-bold text-red-600">{getNonConconformitiesCount(b.nonConformities)} Não-Conformidades</span>
                        </div>
                        {(b.ensaioForaDoPrazo === true || b.ensaioForaDoPrazo === 'true') && (
                          <div className="text-[10px] bg-amber-50 text-amber-800 px-2.5 py-1.5 rounded-xl border border-amber-200/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1 mt-1">
                            <span className="font-bold flex items-center gap-1">⚠️ Ensaio fora do prazo</span>
                            <span className="font-sans font-semibold text-[9px] uppercase bg-white px-2 py-0.5 rounded-md border border-amber-200 shadow-xs">
                              Início: {formatDateShort(b.periodoInicial)} | Fim: {formatDateShort(b.periodoFinal)} | Ensaios: {b.numEnsaios || 0}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes/Observations */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-[#5A5A40]/70">Observações adicionais / Detalhes</label>
                  <textarea
                    placeholder="Adicione observações para constar no histórico oficial desta notificação (Ex: Ofício nº 48/2026 enviado por email, etc)..."
                    className="w-full p-3 bg-white border border-[#e5e5e0] rounded-xl focus:ring-2 focus:ring-[#5A5A40]/20 text-xs h-28 resize-none"
                    value={notificationNotes}
                    onChange={e => setNotificationNotes(e.target.value)}
                  />
                </div>

              </div>

              <div className="p-6 bg-gray-50 border-t border-[#e5e5e0] flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setGeneratingForPac(null)}
                  className="px-5 py-2.5 border border-[#e5e5e0] hover:bg-gray-100 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingNotification || notificationTypes.length === 0}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-md"
                >
                  {isSavingNotification ? 'Salvando...' : 'Confirmar e Registrar'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* VIEWING, ON-THE-FLY EDITING AND EXPORTING MODAL */}
      {viewingNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            
            {/* Header */}
            <div className="p-6 border-b border-[#e5e5e0] bg-gray-50 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#5A5A40]">Central de Notificações Oficiais</span>
                <h3 className="font-display font-bold text-xl text-gray-900 leading-tight">
                  Visualizar e Exportar Documento: {viewingNotification.pac_name}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setViewingNotification(null)} 
                className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
              
              {/* LEFT COLUMN: On-The-Fly Quick Editor (lg:col-span-6) */}
              <div className="lg:col-span-5 border-r border-[#e5e5e0] flex flex-col h-full bg-gray-50/50">
                <div className="p-5 border-b border-[#e5e5e0] space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5A5A40]/80">1. Escolha o Canal & Edite o Conteúdo</span>
                  
                  {/* Channels Selector inside preview */}
                  <div className="flex bg-gray-200/50 p-1 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewChannel('oficio')}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5",
                        previewChannel === 'oficio' ? "bg-white text-[#5A5A40] shadow-sm" : "text-gray-500 hover:text-gray-800"
                      )}
                    >
                      <FileText size={14} />
                      Ofício
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewChannel('email')}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5",
                        previewChannel === 'email' ? "bg-white text-[#5A5A40] shadow-sm" : "text-gray-500 hover:text-gray-800"
                      )}
                    >
                      <Mail size={14} />
                      E-mail
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewChannel('whatsapp')}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5",
                        previewChannel === 'whatsapp' ? "bg-white text-[#5A5A40] shadow-sm" : "text-gray-500 hover:text-gray-800"
                      )}
                    >
                      <MessageSquare size={14} />
                      WhatsApp
                    </button>
                  </div>
                </div>

                {/* Left Active Fields scroll wrapper */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  
                  {/* General Notification/Rectification Notes */}
                  <div className="space-y-1.5 bg-amber-500/5 p-3 rounded-2xl border border-amber-500/10 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={13} className="text-amber-600 shrink-0" />
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                        Observações e Retificações Gerais
                      </label>
                    </div>
                    <textarea 
                      rows={2}
                      placeholder="Adicione observações ou anotações sobre as retificações feitas nesta notificação..."
                      className="w-full p-2 bg-white border border-[#e5e5e0] rounded-xl text-xs leading-normal resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/30 font-medium"
                      value={viewingNotificationNotes}
                      onChange={e => setViewingNotificationNotes(e.target.value)}
                    />
                  </div>
                  
                  {/* Ofício editor inputs */}
                  {previewChannel === 'oficio' && (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-400">Título Principal</label>
                        <input 
                          type="text"
                          className="w-full p-2.5 bg-white border border-[#e5e5e0] rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#5A5A40]/30"
                          value={editableOficioTitle}
                          onChange={e => setEditableOficioTitle(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-400">Processo / Data</label>
                        <textarea 
                          rows={2}
                          className="w-full p-2.5 bg-white border border-[#e5e5e0] rounded-xl text-xs font-semibold resize-none focus:outline-none focus:ring-1 focus:ring-[#5A5A40]/30"
                          value={editableOficioProcess}
                          onChange={e => setEditableOficioProcess(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-400">Introdução do Documento</label>
                        <textarea 
                          rows={2}
                          className="w-full p-2.5 bg-white border border-[#e5e5e0] rounded-xl text-xs font-semibold resize-none focus:outline-none focus:ring-1 focus:ring-[#5A5A40]/30"
                          value={editableOficioIntro}
                          onChange={e => setEditableOficioIntro(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-405 block">Assinatura de Ofício</label>
                        <select
                          className="w-full p-2.5 bg-white border border-[#e5e5e0] rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#5A5A40]/30"
                          value={selectedSignatureId}
                          onChange={e => setSelectedSignatureId(e.target.value)}
                        >
                          <option value="">Nenhuma Assinatura (Texto Padrão)</option>
                          {signatures && signatures.map((sig: any) => (
                            <option key={sig.id} value={sig.id}>{sig.name} ({sig.role})</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-3 pt-2">
                        <span className="text-[10px] font-bold uppercase text-[#5A5A40] block border-b border-gray-200 pb-1">Seções Editáveis do Modelo</span>
                        {editableOficioSections.map((section: any) => (
                          <div key={section.id} className="p-3 bg-white border border-gray-200 rounded-xl space-y-2.5 shadow-sm">
                            <div className="flex justify-between items-center gap-2">
                              <input 
                                type="text"
                                className="font-bold text-[10px] uppercase bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-gray-700"
                                value={section.title}
                                onChange={e => handleEditableSectionTitleChange(section.id, e.target.value)}
                              />

                              {/* Editable Icon selection directly in the previewer! */}
                              <div className="flex gap-0.5 items-center bg-gray-50 border border-gray-200 rounded px-1 py-0.5">
                                {AVAILABLE_ICONS.map(ic => {
                                  const IconComp = ic.icon;
                                  const isSelected = section.icon === ic.id;
                                  return (
                                    <button
                                      key={ic.id}
                                      type="button"
                                      onClick={() => handleEditableSectionIconChange(section.id, ic.id)}
                                      title={ic.name}
                                      className={cn(
                                        "p-0.5 rounded transition-transform text-xs",
                                        isSelected ? "bg-[#5A5A40] text-white scale-110" : "text-gray-400 hover:text-gray-600"
                                      )}
                                    >
                                      <IconComp size={10} />
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <textarea
                              rows={3}
                              className="w-full p-2 bg-gray-50 border border-gray-100 rounded-md text-[11px] leading-relaxed focus:outline-none"
                              value={section.content}
                              onChange={e => handleEditableSectionContentChange(section.id, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Email editor inputs */}
                  {previewChannel === 'email' && (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-400">Assunto</label>
                        <input 
                          type="text"
                          className="w-full p-2.5 bg-white border border-[#e5e5e0] rounded-xl text-xs font-semibold focus:outline-none"
                          value={editableEmailSubject}
                          onChange={e => setEditableEmailSubject(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-400">Mensagem</label>
                        <textarea 
                          rows={14}
                          className="w-full p-3 bg-white border border-[#e5e5e0] rounded-xl text-xs font-semibold"
                          value={editableEmailBody}
                          onChange={e => setEditableEmailBody(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* WhatsApp editor inputs */}
                  {previewChannel === 'whatsapp' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Mensagem Formatada</label>
                      <textarea 
                        rows={16}
                        className="w-full p-3 bg-white border border-[#e5e5e0] rounded-xl text-xs font-semibold font-mono"
                        value={editableWhatsapp}
                        onChange={e => setEditableWhatsapp(e.target.value)}
                      />
                    </div>
                  )}

                </div>
              </div>

              {/* RIGHT COLUMN: Realistic Live Compiled Display (lg:col-span-7) */}
              <div className="lg:col-span-7 flex flex-col h-full bg-[#fcfcf0]/10 p-6 overflow-hidden">
                <div className="flex-1 overflow-y-auto pr-1">
                  
                  {previewChannel === 'oficio' ? (
                    // Santa Catarina & IMETRO-SC Autuação Layout emulation (High Fidelity matched to image)
                    <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-xs font-sans space-y-6 max-w-2xl mx-auto border-t-[8px] border-[#5A5A40]">
                      
                      {/* Logo and header */}
                      <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                        <div className="flex items-center gap-2">
                          {logoUrl ? (
                            <img src={logoUrl} alt="Logo IPEM-PR" className="max-h-[42px] w-auto object-contain font-bold text-[#5A5A40]" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="font-bold text-lg border-2 border-[#5A5A40] text-[#5A5A40] px-2 py-0.5 rounded-lg font-display tracking-tight">IPEM-PR</span>
                          )}
                          <div className="text-[8px] tracking-wide text-gray-400 font-bold uppercase font-mono leading-tight">
                            Órgão Delegado<br/>
                            IPEM-PR
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <h4 className="font-display font-extrabold text-[#1a1a1a] tracking-tight">{editableOficioTitle}</h4>
                          <span className="inline-block bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1 text-[10px] text-[#5A5A40] font-bold whitespace-pre-line leading-relaxed text-left">
                            {editableOficioProcess}
                          </span>
                        </div>
                      </div>

                      {/* Intro text */}
                      <p className="text-gray-600 font-medium leading-relaxed">{editableOficioIntro}</p>

                      {/* Notified PAC entity detail banner */}
                      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-[11px]">
                        <strong className="text-gray-800 font-mono uppercase block text-[9px] text-gray-400 mb-1">Empresa Alvo do Processo Administrativo:</strong>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-700">
                          <div><strong>NOME:</strong> {viewingNotification.pac_name}</div>
                          <div><strong>CNPJ/REGISTRO:</strong> 02.943.486/0001-70</div>
                        </div>
                      </div>

                      {/* Customizable content sections built similar to target image */}
                      <div className="space-y-4">
                        {editableOficioSections.map((s: any) => {
                          const IconComp = getIconComponent(s.icon);
                          return (
                            <div key={s.id} className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <div className="p-2.5 bg-[#f5f5f0] border border-gray-100 text-[#5A5A40] rounded-xl">
                                  <IconComp size={15} />
                                </div>
                                <div className="w-0.5 bg-gray-100 flex-1 min-h-[16px] mt-1"></div>
                              </div>
                              <div className="flex-1 bg-gray-50/55 p-4 rounded-2xl border border-gray-100/80">
                                <h5 className="font-bold text-[10px] text-gray-900 tracking-wider mb-1.5 uppercase">{s.title || 'SEÇÃO'}</h5>
                                <p className="text-gray-600 leading-relaxed text-[11px] whitespace-pre-wrap">{s.content || ''}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Digital print signature trace */}
                      {selectedSignatureId && signatures.find((s: any) => s.id === selectedSignatureId) ? (
                        (() => {
                          const sig = signatures.find((s: any) => s.id === selectedSignatureId);
                          return (
                            <div className="pt-6 border-t border-gray-200 flex flex-col items-center text-center space-y-1">
                              <div className="h-[55px] flex items-center justify-center mb-1">
                                <img src={sig.imageUrl} alt={sig.name} className="max-h-[50px] w-auto object-contain" referrerPolicy="no-referrer" />
                              </div>
                              <div className="w-48 border-b border-gray-200"></div>
                              <span className="text-[10px] text-gray-800 font-bold mt-1 inline-block">{sig.name}</span>
                              <span className="text-[8px] text-gray-400 uppercase font-mono">{sig.role}</span>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="pt-6 border-t border-gray-100 flex flex-col items-center text-center space-y-1">
                          <div className="w-40 border-b border-gray-300"></div>
                          <span className="text-[10px] text-gray-500 font-bold uppercase mt-1">IPEM-PR Setor Metrológico</span>
                          <span className="text-[8px] text-gray-400">Emissão Eletrônica Autenticada</span>
                        </div>
                      )}

                    </div>
                  ) : previewChannel === 'email' ? (
                    // Email Interface simulation
                    <div className="bg-white rounded-2xl border border-gray-250 shadow-md text-xs max-w-2xl mx-auto overflow-hidden">
                      <div className="bg-gray-100 p-4 border-b border-gray-200 space-y-2 text-gray-600">
                        <div className="flex">
                          <span className="w-16 font-bold uppercase text-[9px] tracking-wider text-gray-400">Para:</span>
                          <span className="font-semibold text-gray-700">regulatorio@{viewingNotification.pac_name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.br</span>
                        </div>
                        <div className="flex border-t border-gray-200/50 pt-2">
                          <span className="w-16 font-bold uppercase text-[9px] tracking-wider text-gray-400">Assunto:</span>
                          <span className="font-bold text-gray-950 text-[11px]">{editableEmailSubject}</span>
                        </div>
                      </div>
                      <div className="p-6 bg-gray-50/10 min-h-[400px] leading-relaxed text-gray-800 whitespace-pre-wrap">
                        {editableEmailBody}
                      </div>
                    </div>
                  ) : (
                    // WhatsApp Bubble device mock
                    <div className="bg-[#efeae2] rounded-3xl border border-gray-300 shadow-lg max-w-sm mx-auto overflow-hidden flex flex-col h-[500px]">
                      <div className="bg-[#075e54] p-3 flex items-center text-white gap-2 shrink-0">
                        <span className="w-8 h-8 rounded-full bg-emerald-100 text-teal-900 font-extrabold flex items-center justify-center text-xs">IM</span>
                        <div>
                          <h4 className="font-bold text-xs">IMETRO-SC Notificações</h4>
                          <span className="text-[8px] opacity-75 block">Online • Canal Comercial</span>
                        </div>
                      </div>
                      <div className="flex-1 p-4 overflow-y-auto bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat flex flex-col justify-end">
                        <div className="bg-[#dcf8c6] p-3 rounded-2xl border border-gray-200 shadow-sm self-end max-w-[85%] text-gray-800 leading-relaxed text-[11px] whitespace-pre-wrap">
                          {editableWhatsapp}
                          <div className="text-[8px] text-gray-400 text-right mt-1 font-mono">
                            {new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})} ✓✓
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>

            {/* Footer actions */}
            <div className="p-5 border-t border-[#e5e5e0] bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <span className="text-xs text-gray-500 font-medium">
                Você pode editar temporariamente qualquer campo na coluna da esquerda antes de exportar.
              </span>
              
              <div className="flex gap-2.5 self-end">
                <button
                  type="button"
                  onClick={handleCopyViewingText}
                  className="bg-white hover:bg-gray-100 transition-colors border border-gray-200 py-2.5 px-5 rounded-xl font-bold text-xs text-[#5A5A40] flex items-center gap-1.5"
                >
                  {copiedPreviewSuccess ? (
                    <>
                      <Check size={14} className="text-emerald-600" />
                      Copiado com Sucesso!
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      Copiar Texto
                    </>
                  )}
                </button>

                {previewChannel === 'oficio' && (
                  <button
                    type="button"
                    onClick={handlePrintViewingPDF}
                    className="bg-[#5A5A40] hover:bg-[#4a4a30] transition-colors py-2.5 px-6 rounded-xl font-bold text-xs text-white flex items-center gap-1.5 shadow-md"
                  >
                    <Printer size={14} />
                    Imprimir / Baixar PDF
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveRectification}
                  disabled={isSavingNotification}
                  className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 transition-colors py-2.5 px-5 rounded-xl font-bold text-xs text-white flex items-center gap-1.5 shadow-md shadow-amber-500/10"
                >
                  <Sparkles size={14} />
                  {isSavingNotification ? 'Retificando...' : 'Retificar Notificação'}
                </button>

                <button
                  type="button"
                  onClick={() => setViewingNotification(null)}
                  className="bg-gray-200 hover:bg-gray-300 transition-colors py-2.5 px-5 rounded-xl font-bold text-xs text-gray-700"
                >
                  Fechar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Excluir Notification Confirmation Modal */}
      {notifToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden p-6 text-center space-y-4 animate-in zoom-in duration-200">
            <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-600">
              <AlertTriangle size={24} />
            </div>
            
            <div className="space-y-1">
              <h4 className="text-lg font-bold text-gray-900 tracking-tight">Excluir Notificação Administrativa?</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Tem certeza de que deseja permanente excluir esta notificação? Esta ação não pode ser desfeita e removerá o histórico administrativo correspondente do sistema.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setNotifToDelete(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 text-xs font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await confirmDeleteNotification(notifToDelete);
                  setNotifToDelete(null);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 transition-colors text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/15"
              >
                <Trash2 size={13} />
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
