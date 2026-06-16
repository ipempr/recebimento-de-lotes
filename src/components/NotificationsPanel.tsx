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
  Phone
} from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
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
  logoUrl = ''
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

  // Filter for batches with at least one nonconformity plate
  const activeNCBatches = batchesWithNCs.filter(b => b.nonConformities && b.nonConformities.length > 0);

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

  // Handle Generating notification
  const handleOpenGenerateModal = (pac: any) => {
    setGeneratingForPac(pac);
    setSelectedTypeId('');
    setNotificationNotes('');
    setSubmittingError(null);
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
        processHeader: `Processo IMETRO-SC 52603.000007/2026-31\nde ${formatDateShort(item.createdAt || new Date())}.`,
        intro: 'O Instituto de Metrologia de Santa Catarina - IMETRO/SC abriu um processo administrativo contra:',
        sections: [
          { id: '1', icon: 'search', title: 'MOTIVO', content: 'Identificamos a(s) irregularidade(s) descrita(s) no auto de infração em anexo.\nNúmero do Auto de Infração: 3218663\n\nNo lote analisado, composto de {total_ensaios} ensaios, identificamos {erros_encontrados} desvios, o que corresponde a um percentual de irregularidade de {percentual_erro}%.\n\nRelação de placas com não-conformidades encontradas:\n{placas_nao_conformes}' },
          { id: '2', icon: 'check-square', title: 'COMO SE DEFENDER?', content: 'Você poderá apresentar a defesa por escrito em até 10(dez) dias, contados da data de recebimento desta notificação. Na defesa, informe:\n\n1. Nome do órgão que o notificou: IMETRO-SC;\n2. Nome, CPF/CNPJ e assinatura;\n3. Número do Processo e do(s) Auto(s) de Infração;\n4. Motivo da defesa detalhado.' },
          { id: '3', icon: 'alert-triangle', title: 'IMPORTANTE', content: 'Você deve enviar uma cópia do seu documento de identificação oficial junto com a defesa. E se você estiver representado por procurador legal, não esqueça de encaminhar a procuração.' },
          { id: '4', icon: 'send', title: 'PARA ONDE ENVIAR?', content: 'Envie sua defesa para o IMETRO-SC, localizado em São José, na R. DO IANO, 1791, bairro Nossa Senhora do Rosário, CEP 88110-603.' },
          { id: '5', icon: 'help-circle', title: 'DÚVIDAS?', content: 'Envie e-mail para inmetro-sc@imetro.sc.gov.br ou entre em contato pelo telefone (0XX48) 3381-5200.' }
        ]
      },
      email: {
        subject: 'Notificação Urgente de Irregularidade - PAC {pac_nome}',
        body: 'Prezados,\n\nConstatamos não-conformidades técnicas nos lotes do PAC {pac_nome}.\n\n{motivo_detalhes}\n\nReiteramos que o percentual de falhas detectadas foi de {percentual_erro}%. Verifique as instruções abaixo para apresentar a defesa prévia em até 10 dias corridos.\n\nAtenciosamente,\nIMETRO-SC.'
      },
      whatsapp: {
        template: '⚠️ *NOTIFICAÇÃO DE AUTUAÇÃO - IMETRO-SC*\n\nInformamos que foi aberto o processo administrativo para o *PAC {pac_nome}* devido a desvios encontrados nos ensaios.\n\n*Índice de Irregularidades:* {percentual_erro}% ({erros_encontrados} falhas de {total_ensaios} ensaios).\n\n📄 *Placas Não-Conformes:* \n{placas_nao_conformes}\n\n⚖️ *Como se defender?*\nVocê possui até 10 dias úteis para apresentar recurso formalizado por escrito para o IMETRO-SC, contendo justificativas, documento de identificação e procuração (caso aplicável).\n\nDúvidas: inmetro-sc@imetro.sc.gov.br ou (48) 3381-5200.'
      }
    };

    const notificationBatchesIds = (item.batches || []).map((b: any) => b.id);
    const fullBatches = batchesWithNCs.filter(b => notificationBatchesIds.includes(b.id));

    let totalEnsaios = 0;
    const nonConformingPlates: string[] = [];
    const groundsUnique = new Set<string>();

    fullBatches.forEach(b => {
      totalEnsaios += (b.numEnsaios || 0);
      const ncs = b.nonConformities || [];
      ncs.forEach((nc: any) => {
        groundsUnique.add(nc.nao_conformidade_name);
        (nc.placas || []).forEach((p: string) => {
          nonConformingPlates.push(`${p.trim().toUpperCase()} (${nc.nao_conformidade_name})`);
        });
      });
    });

    const errosEncontrados = nonConformingPlates.length;
    const percentualErro = totalEnsaios > 0 ? ((errosEncontrados / totalEnsaios) * 100).toFixed(2) : '0.00';
    const platesJoinedFormatted = nonConformingPlates.join(', ') || '(Nenhuma placa encontrada)';
    const reasonsJoinedFormatted = Array.from(groundsUnique).join(', ') || 'Nenhum desvio específico';

    const compilePlaceholders = (text: string) => {
      if (!text) return '';
      return text
        .replace(/{pac_nome}/g, item.pac_name || '')
        .replace(/{cnpj}/g, '02.943.486/0001-70')
        .replace(/{total_ensaios}/g, String(totalEnsaios))
        .replace(/{erros_encontrados}/g, String(errosEncontrados))
        .replace(/{percentual_erro}/g, percentualErro)
        .replace(/{placas_nao_conformes}/g, platesJoinedFormatted)
        .replace(/{motivo_detalhes}/g, reasonsJoinedFormatted)
        .replace(/{data_atual}/g, formatDateShort(item.createdAt || new Date()));
    };

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

    setViewingNotification(item);
    setPreviewChannel('oficio');
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
        <div style="display: flex; margin-bottom: 24px; font-family: sans-serif;">
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

    printWindow.document.write(`
      <html>
        <head>
          <title>${editableOficioTitle} - ${viewingNotification?.pac_name}</title>
          <style>
            @media print {
              body { margin: 2cm; -webkit-print-color-adjust: exact; }
              .no-print { display: none; }
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

          <div class="target-box">
            <strong>EMPRESA NOTIFICADA:</strong> ${viewingNotification?.pac_name}<br/>
            <strong>CNPJ/ID:</strong> 02.943.486/0001-70
          </div>

          <div class="sections-container">
            ${sectionsHTML}
          </div>

          <div style="margin-top: 60px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 20px;">
            Documento gerado eletronicamente pelo Sistema de Recebimento de Lotes IPEM-PR.
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
                
                <button
                  onClick={() => handleOpenGenerateModal(pac)}
                  className="bg-[#5A5A40] text-white hover:bg-[#4a4a30] transition-colors py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm"
                >
                  <Bell size={14} />
                  GERAR NOTIFICAÇÃO
                </button>
              </div>

              {/* Batches list */}
              <div className="p-6 space-y-4 flex-1">
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
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500 font-mono">
                              P: {formatDateShort(batch.periodoInicial)} - {formatDateShort(batch.periodoFinal)}
                            </span>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 roundedbg bg-[#5A5A40]/10 text-[#5A5A40]">
                              {batch.status}
                            </span>
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
                  <div className="space-y-1 mt-1 text-xs text-[#5A5A40]">
                    {generatingForPac.batches.map((b: any, index: number) => (
                      <div key={b.id || index} className="flex justify-between font-mono">
                        <span>Lote ({formatDateShort(b.periodoInicial)} - {formatDateShort(b.periodoFinal)})</span>
                        <span className="font-bold text-red-600">{getNonConconformitiesCount(b.nonConformities)} Não-Conformidades</span>
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
                      <div className="pt-6 border-t border-gray-100 flex flex-col items-center text-center space-y-1">
                        <div className="w-40 border-b border-gray-300"></div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase mt-1">IMETRO-SC Setor Metrológico</span>
                        <span className="text-[8px] text-gray-400">Emissão Eletrônica Autenticada</span>
                      </div>

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

    </div>
  );
}
