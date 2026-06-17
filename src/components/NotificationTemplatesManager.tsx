import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  CheckSquare, 
  AlertTriangle, 
  Send, 
  HelpCircle, 
  Mail, 
  MessageSquare, 
  Copy, 
  Download, 
  Check, 
  Info, 
  AlertCircle,
  Save,
  Phone,
  Grid,
  FileSpreadsheet,
  ChevronRight,
  Menu,
  Sparkles,
  RefreshCw,
  Printer
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

// Available icons with their corresponding component, name, and visual representations
export const AVAILABLE_ICONS = [
  { id: 'search', name: 'Lupa (Motivo)', icon: Search },
  { id: 'check-square', name: 'Checklist (Defesa)', icon: CheckSquare },
  { id: 'alert-triangle', name: 'Alerta (Importante)', icon: AlertTriangle },
  { id: 'send', name: 'Seta/Envio (Onde enviar)', icon: Send },
  { id: 'help-circle', name: 'Interrogação (Dúvidas)', icon: HelpCircle },
  { id: 'file-text', name: 'Documento (Ofício)', icon: FileText },
  { id: 'mail', name: 'E-mail', icon: Mail },
  { id: 'message-square', name: 'WhatsApp', icon: MessageSquare },
  { id: 'phone', name: 'Telefone', icon: Phone },
  { id: 'info', name: 'Informação', icon: Info }
];

export function getIconComponent(id: string) {
  const item = AVAILABLE_ICONS.find(i => i.id === id);
  return item ? item.icon : FileText;
}

interface NotificationTemplatesManagerProps {
  notificationTypes: any[];
  setNotificationTypes: React.Dispatch<React.SetStateAction<any[]>>;
  isLocalMode: boolean;
  handleFirestoreError: (err: any, op: string, col: string) => void;
  batches: any[];
  pacs: any[];
  nonConformityRecords: any[];
  nonConformitiesConfigs: any[];
  logoUrl?: string;
  signatures?: any[];
}

export default function NotificationTemplatesManager({
  notificationTypes,
  setNotificationTypes,
  isLocalMode,
  handleFirestoreError,
  batches,
  pacs,
  nonConformityRecords,
  nonConformitiesConfigs,
  logoUrl = '',
  signatures = []
}: NotificationTemplatesManagerProps) {
  
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [activeChannel, setActiveChannel] = useState<'oficio' | 'email' | 'whatsapp'>('oficio');
  const [selectedPacId, setSelectedPacId] = useState<string>('sample-pac');
  
  // Local template editor states
  const [oficioTitle, setOficioTitle] = useState('NOTIFICAÇÃO DE AUTUAÇÃO');
  const [oficioSignatureId, setOficioSignatureId] = useState<string>('');
  const [oficioProcessHeader, setOficioProcessHeader] = useState('Processo IPEM-PR 52603.000007/2026-31\nde 02 de julho de 2026.');
  const [oficioIntro, setOficioIntro] = useState('O Instituto de Pesos e Medidas do Paraná - IPEM-PR abriu um processo administrativo contra:');
  const [oficioSections, setOficioSections] = useState<any[]>([
    { id: '1', icon: 'search', title: 'MOTIVO', content: 'Identificamos a(s) irregularidade(s) descrita(s) no auto de infração em anexo.\nNúmero do Auto de Infração: 3218663\n\nNo lote analisado, composto de {total_ensaios} ensaios, identificamos {erros_encontrados} desvios, o que corresponde a um percentual de irregularidade de {percentual_erro}%.\n\nRelação de placas com não-conformidades encontradas:\n{placas_nao_conformes}' },
    { id: '2', icon: 'check-square', title: 'COMO SE DEFENDER?', content: 'Você poderá apresentar a defesa por escrito em até 10(dez) dias, contados da data de recebimento desta notificação. Na defesa, informe:\n\n1. Nome do órgão que o notificou: IPEM-PR;\n2. Nome, CPF/CNPJ and assinatura;\n3. Número do Processo e do(s) Auto(s) de Infração;\n4. Motivo da defesa detalhado.' },
    { id: '3', icon: 'alert-triangle', title: 'IMPORTANTE', content: 'Você deve enviar uma cópia do seu documento de identificação oficial junto com a defesa. E se você estiver representado por procurador legal, não esqueça de encaminhar a procuração.' },
    { id: '4', icon: 'send', title: 'PARA ONDE ENVIAR?', content: 'Envie sua defesa para o IPEM-PR, localizado em Curitiba, na Rua Estados Unidos, 1354, bairro Bacacheri, CEP 82510-050.' },
    { id: '5', icon: 'help-circle', title: 'DÚVIDAS?', content: 'Envie e-mail para ouvidoria@ipem.pr.gov.br ou entre em contato pelo telefone (41) 3251-2200.' }
  ]);

  const [emailSubject, setEmailSubject] = useState('Notificação Urgente de Irregularidade - PAC {pac_nome}');
  const [emailBody, setEmailBody] = useState('Prezados,\n\nConstatamos não-conformidades técnicas nos lotes do PAC {pac_nome}.\n\n{motivo_detalhes}\n\nReiteramos que o percentual de falhas detectadas foi de {percentual_erro}%. Verifique as instruções abaixo para apresentar a defesa prévia em até 10 dias corridos.\n\nAtenciosamente,\nIPEM-PR.');

  const [whatsappTemplate, setWhatsappTemplate] = useState('⚠️ *NOTIFICAÇÃO DE AUTUAÇÃO - IPEM-PR*\n\nInformamos que foi aberto o processo administrativo para o *PAC {pac_nome}* devido a desvios encontrados nos ensaios.\n\n*Índice de Irregularidades:* {percentual_erro}% ({erros_encontrados} falhas de {total_ensaios} ensaios).\n\n📄 *Placas Não-Conformes:* \n{placas_nao_conformes}\n\n⚖️ *Como se defender?*\nVocê possui até 10 dias úteis para apresentar recurso formalizado por escrito para o IPEM-PR, contendo justificativas, documento de identificação e procuração (caso aplicável).\n\nDúvidas: ouvidoria@ipem.pr.gov.br ou (41) 3251-2200.');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Load selected template values
  useEffect(() => {
    if (selectedTypeId) {
      const selectedType = notificationTypes.find(t => t.id === selectedTypeId);
      if (selectedType && selectedType.templates) {
        const t = selectedType.templates;
        if (t.oficio) {
          setOficioTitle(t.oficio.title || 'NOTIFICAÇÃO DE AUTUAÇÃO');
          setOficioProcessHeader(t.oficio.processHeader || 'Processo IPEM-PR 52603.000007/2026-31\nde 02 de julho de 2026.');
          setOficioIntro(t.oficio.intro || '');
          setOficioSections(t.oficio.sections || []);
          setOficioSignatureId(t.oficio.signatureId || '');
        }
        if (t.email) {
          setEmailSubject(t.email.subject || '');
          setEmailBody(t.email.body || '');
        }
        if (t.whatsapp) {
          setWhatsappTemplate(t.whatsapp.template || '');
        }
      } else {
        // Fallback to default templates
        setOficioTitle('NOTIFICAÇÃO DE AUTUAÇÃO');
        setOficioProcessHeader('Processo IPEM-PR 52603.000007/2026-31\nde 02 de julho de 2026.');
        setOficioIntro('O Instituto de Pesos e Medidas do Paraná - IPEM-PR abriu um processo administrativo contra:');
        setOficioSections([
          { id: '1', icon: 'search', title: 'MOTIVO', content: 'Identificamos a(s) irregularidade(s) descrita(s) no auto de infração em anexo.\nNúmero do Auto de Infração: 3218663\n\nNo lote analisado, composto de {total_ensaios} ensaios, identificamos {erros_encontrados} desvios, o que corresponde a um percentual de irregularidade de {percentual_erro}%.\n\nRelação de placas com não-conformidades encontradas:\n{placas_nao_conformes}' },
          { id: '2', icon: 'check-square', title: 'COMO SE DEFENDER?', content: 'Você poderá apresentar a defesa por escrito em até 10(dez) dias, contados da data de recebimento desta notificação. Na defesa, informe:\n\n1. Nome do órgão que o notificou: IPEM-PR;\n2. Nome, CPF/CNPJ e assinatura;\n3. Número do Processo e do(s) Auto(s) de Infração;\n4. Motivo da defesa detalhado.' },
          { id: '3', icon: 'alert-triangle', title: 'IMPORTANTE', content: 'Você deve enviar uma cópia do seu documento de identificação oficial junto com a defesa. E se você estiver representado por procurador legal, não esqueça de encaminhar a procuração.' },
          { id: '4', icon: 'send', title: 'PARA ONDE ENVIAR?', content: 'Envie sua defesa para o IPEM-PR, localizado em Curitiba, na Rua Estados Unidos, 1354, bairro Bacacheri, CEP 82510-050.' },
          { id: '5', icon: 'help-circle', title: 'DÚVIDAS?', content: 'Envie e-mail para ouvidoria@ipem.pr.gov.br ou entre em contato pelo telefone (41) 3251-2200.' }
        ]);
        setEmailSubject('Notificação Urgente de Irregularidade - PAC {pac_nome}');
        setEmailBody('Prezados,\n\nConstatamos não-conformidades técnicas nos lotes do PAC {pac_nome}.\n\n{motivo_detalhes}\n\nReiteramos que o percentual de falhas detectadas foi de {percentual_erro}%. Verifique as instruções abaixo para apresentar a defesa prévia em até 10 dias corridos.\n\nAtenciosamente,\nIPEM-PR.');
        setWhatsappTemplate('⚠️ *NOTIFICAÇÃO DE AUTUAÇÃO - IPEM-PR*\n\nInformamos que foi aberto o processo administrativo para o *PAC {pac_nome}* devido a desvios encontrados nos ensaios.\n\n*Índice de Irregularidades:* {percentual_erro}% ({erros_encontrados} falhas de {total_ensaios} ensaios).\n\n📄 *Placas Não-Conformes:* \n{placas_nao_conformes}\n\n⚖️ *Como se defender?*\nVocê possui até 10 dias úteis para apresentar recurso formalizado por escrito para o IPEM-PR, contendo justificativas, documento de identificação e procuração (caso aplicável).\n\nDúvidas: ouvidoria@ipem.pr.gov.br ou (41) 3251-2200.');
        setOficioSignatureId('');
      }
    }
  }, [selectedTypeId, notificationTypes]);

  // Handle saving the edited templates properties
  const handleSaveTemplates = async () => {
    if (!selectedTypeId) return;
    
    setIsSaving(true);
    setSaveSuccess(false);

    const templates = {
      oficio: {
        title: oficioTitle,
        processHeader: oficioProcessHeader,
        intro: oficioIntro,
        sections: oficioSections,
        signatureId: oficioSignatureId
      },
      email: {
        subject: emailSubject,
        body: emailBody
      },
      whatsapp: {
        template: whatsappTemplate
      }
    };

    try {
      if (isLocalMode) {
        const updated = notificationTypes.map(t => {
          if (t.id === selectedTypeId) {
            return { ...t, templates };
          }
          return t;
        });
        setNotificationTypes(updated);
        localStorage.setItem('lotes_notification_types', JSON.stringify(updated));
      } else {
        await updateDoc(doc(db, 'notification_types', selectedTypeId), { templates });
        // Local state update is handled dynamically via snapshot, but safe to reflect locally too
        const updated = notificationTypes.map(t => t.id === selectedTypeId ? { ...t, templates } : t);
        setNotificationTypes(updated);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      handleFirestoreError(e, 'update', `notification_types/${selectedTypeId}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Pre-load the first available notification type on start
  useEffect(() => {
    if (notificationTypes.length > 0 && !selectedTypeId) {
      setSelectedTypeId(notificationTypes[0].id);
    }
  }, [notificationTypes, selectedTypeId]);

  // Extract actual data based on selected PAC
  const getSelectedPacMetrics = () => {
    if (selectedPacId === 'sample-pac') {
      return {
        pacName: 'SEA METALÚRGICA LTDA',
        cnpj: '02.943.486/0001-70',
        totalEnsaios: 15,
        errosEncontrados: 6,
        percentualErro: '40.00',
        placasNaoConformesList: 'ABC1C34 (Placa não cadastrada), XYZ9O87 (Lacre rompido), KKK4J12 (Placa não cadastrada)',
        enquadramentos: 'Artigo 12, item II da Portaria 48/INMETRO.',
        processo: 'IMETRO-SC 52603.000007/2026-31'
      };
    }

    const pacObj = pacs.find(p => p.id === selectedPacId || p.name === selectedPacId);
    if (!pacObj) {
      return {
        pacName: 'PAC Desconhecido',
        cnpj: '00.000.000/0000-00',
        totalEnsaios: 0,
        errosEncontrados: 0,
        percentualErro: '0.00',
        placasNaoConformesList: '(Nenhuma placa não-conforme vinculada)',
        enquadramentos: 'Nenhum',
        processo: 'IMETRO-SC'
      };
    }

    // Filter batches for this PAC with nonConformities
    const pacBatches = batches.filter(b => b.pac === pacObj.name || b.pac === pacObj.id);
    let totalEnsaios = 0;
    const nonConformingPlates: string[] = [];
    const groundsUnique = new Set<string>();

    pacBatches.forEach(b => {
      totalEnsaios += (b.numEnsaios || 0);
      const ncs = isLocalMode 
        ? (b.nonConformities || []) 
        : (nonConformityRecords || [])
            .filter(nc => nc.recebimento_lote_id === b.id)
            .map(nc => {
              const r = nonConformitiesConfigs.find(c => c.id === nc.nao_conformidade_id);
              return {
                id: nc.id,
                nao_conformidade_name: r ? r.name : 'Outro',
                placas: nc.placas || []
              };
            });

      ncs.forEach((nc: any) => {
        groundsUnique.add(nc.nao_conformidade_name);
        (nc.placas || []).forEach((p: string) => {
          nonConformingPlates.push(`${p.trim().toUpperCase()} (${nc.nao_conformidade_name})`);
        });
      });
    });

    const totalErros = nonConformingPlates.length;
    const percent = totalEnsaios > 0 ? ((totalErros / totalEnsaios) * 100).toFixed(2) : '0.00';

    return {
      pacName: pacObj.name,
      cnpj: pacObj.cnpj || '02.943.486/0001-70', // mock if not present
      totalEnsaios,
      errosEncontrados: totalErros,
      percentualErro: percent,
      placasNaoConformesList: nonConformingPlates.join(', ') || '(Nenhuma placa encontrada)',
      enquadramentos: Array.from(groundsUnique).join(', ') || 'Sem enquadramentos',
      processo: `IMETRO-SC 52603.000${selectedPacId.slice(-3) || '999'}/2026-31`
    };
  };

  const metrics = getSelectedPacMetrics();

  // Helper function to replace templates parameters
  const renderTemplateText = (text: string) => {
    if (!text) return '';
    return text
      .replace(/{pac_nome}/g, metrics.pacName)
      .replace(/{cnpj}/g, metrics.cnpj)
      .replace(/{total_ensaios}/g, String(metrics.totalEnsaios))
      .replace(/{erros_encontrados}/g, String(metrics.errosEncontrados))
      .replace(/{percentual_erro}/g, metrics.percentualErro)
      .replace(/{placas_nao_conformes}/g, metrics.placasNaoConformesList)
      .replace(/{motivo_detalhes}/g, metrics.enquadramentos)
      .replace(/{data_atual}/g, new Date().toLocaleDateString('pt-BR'));
  };

  // Icon preview list builder
  const handleIconChange = (sectionId: string, iconId: string) => {
    setOficioSections(prev => 
      prev.map(s => s.id === sectionId ? { ...s, icon: iconId } : s)
    );
  };

  const handleSectionTitleChange = (sectionId: string, val: string) => {
    setOficioSections(prev => 
      prev.map(s => s.id === sectionId ? { ...s, title: val } : s)
    );
  };

  const handleSectionContentChange = (sectionId: string, val: string) => {
    setOficioSections(prev => 
      prev.map(s => s.id === sectionId ? { ...s, content: val } : s)
    );
  };

  // Preview full text compiler
  const getCompiledText = () => {
    if (activeChannel === 'oficio') {
      const header = renderTemplateText(oficioTitle) + '\n' + renderTemplateText(oficioProcessHeader) + '\n\n' + renderTemplateText(oficioIntro) + '\n\n';
      const sectionsString = oficioSections.map(s => 
        `[${s.title}]\n${renderTemplateText(s.content)}`
      ).join('\n\n');
      return header + sectionsString;
    } else if (activeChannel === 'email') {
      return `Assunto: ${renderTemplateText(emailSubject)}\n\n${renderTemplateText(emailBody)}`;
    } else {
      return renderTemplateText(whatsappTemplate);
    }
  };

  // Copy to clipboard
  const copyToClipboard = () => {
    const text = getCompiledText();
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Trigger high fidelity PDF Print Dialogue
  const handlePrintPDF = () => {
    const currentSignatureObj = signatures.find((s: any) => s.id === oficioSignatureId);
    // Generate simple printable element in a new print window to maintain pristine design of Santa Catarina's layout
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

    const sectionsHTML = oficioSections.map(s => {
      const formattedContent = renderTemplateText(s.content).replace(/\n/g, '<br/>');
      return `
        <div class="print-avoid-break" style="display: flex; margin-bottom: 24px; font-family: sans-serif; page-break-inside: avoid; break-inside: avoid;">
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
          <title>${renderTemplateText(oficioTitle)} - ${metrics.pacName}</title>
          <style>
            @media print {
              body { 
                margin: 1.5cm 2cm; 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
              }
              .no-print { display: none; }
              .print-avoid-break { 
                page-break-inside: avoid !important; 
                break-inside: avoid !important; 
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
              color:#0f172a;
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
            .tagline {
              font-size: 14px;
              color: #475569;
              margin-bottom: 30px;
              font-weight: 500;
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
            .print-avoid-break {
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
              <h1>${renderTemplateText(oficioTitle)}</h1>
              <div class="process-badge">
                ${renderTemplateText(oficioProcessHeader).replace(/\n/g, '<br/>')}
              </div>
            </div>
          </div>

          <div class="tagline">
            ${renderTemplateText(oficioIntro)}
          </div>

          <div class="target-box print-avoid-break">
            <strong>EMPRESA NOTIFICADA:</strong> ${metrics.pacName}<br/>
            <strong>CNPJ/ID:</strong> ${metrics.cnpj}
          </div>

          <div class="sections-container">
            ${sectionsHTML}
          </div>

          ${currentSignatureObj ? `
            <div class="print-avoid-break" style="margin-top: 45px; display: flex; flex-direction: column; align-items: center; text-align: center; font-family: sans-serif; page-break-inside: avoid; break-inside: avoid;">
              <img src="${currentSignatureObj.imageUrl}" style="max-height: 50px; width: auto; object-fit: contain; margin-bottom: 2px;" />
              <div style="width: 220px; border-top: 1.5px solid #cbd5e1; padding-top: 5px; margin: 2px auto 0 auto;">
                <h5 style="margin: 0; font-size: 12px; font-weight: bold; color: #1e293b;">${currentSignatureObj.name}</h5>
                <p style="margin: 2px 0 0 0; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-family: monospace;">${currentSignatureObj.role}</p>
              </div>
            </div>
          ` : `
            <div class="print-avoid-break" style="margin-top: 35px; text-align: center; font-size: 11px; color: #64748b; font-family: sans-serif; font-style: italic; page-break-inside: avoid; break-inside: avoid;">
              Documento assinado eletronicamente pelo Sistema de Recebimento de Lotes IPEM-PR.
            </div>
          `}

          <div class="print-avoid-break" style="margin-top: 45px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 15px; page-break-inside: avoid; break-inside: avoid;">
            Documento gerado eletronicamente pelo Sistema de Recebimento de Lotes IPEM-PR.
          </div>

          <script>
            // Auto open print
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

  const selectedSignatureObj = signatures.find(s => s.id === oficioSignatureId);

  return (
    <div className="bg-white rounded-[32px] border border-[#e5e5e0] p-6 space-y-6">
      
      {/* Title & Type selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-[#e5e5e0]">
        <div>
          <h3 className="font-display font-bold text-xl text-[#5A5A40] flex items-center gap-2">
            <Sparkles size={22} className="text-amber-500" />
            Gerenciar Modelos de Notificações
          </h3>
          <p className="text-xs text-[#5A5A40]/60 mt-0.5">
            Configure e personalize os textos e a estrutura de exportação para cada canal de notificação oficial.
          </p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <label className="text-xs font-bold uppercase shrink-0 text-[#5A5A40]/60">Notificação:</label>
          <select 
            className="flex-1 md:flex-initial p-2.5 bg-[#f5f5f0] border-none rounded-xl text-sm font-semibold text-[#5A5A40] focus:ring-2 focus:ring-[#5A5A40]/20 cursor-pointer"
            value={selectedTypeId}
            onChange={e => setSelectedTypeId(e.target.value)}
          >
            {notificationTypes.map(type => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
        </div>
      </div>

      {notificationTypes.length === 0 ? (
        <div className="text-center py-12 bg-[#f5f5f0] rounded-2xl border border-dashed border-[#5A5A40]/10">
          <AlertCircle className="mx-auto mb-2 text-[#5A5A40]/40 animate-pulse" size={40} />
          <h4 className="font-bold text-[#5A5A40] text-sm">Nenhum Tipo de Notificação Cadastrado</h4>
          <p className="text-xs text-[#5A5A40]/60 max-w-xs mx-auto mt-1">
            Crie um Tipo de Notificação no gerenciador acima para poder configurar e herdar os modelos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          
          {/* LEFT SIDE: Active Editor Controls (xl:col-span-7) */}
          <div className="xl:col-span-7 space-y-6">
            
            {/* Channel Tabs */}
            <div className="flex bg-[#f5f5f0] p-1.5 rounded-2xl gap-2">
              <button
                type="button"
                onClick={() => setActiveChannel('oficio')}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2",
                  activeChannel === 'oficio' ? "bg-white text-[#5A5A40] shadow-sm" : "text-[#5A5A40]/60 hover:text-[#5A5A40]"
                )}
              >
                <FileText size={15} />
                Ofício (PDF)
              </button>
              <button
                type="button"
                onClick={() => setActiveChannel('email')}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2",
                  activeChannel === 'email' ? "bg-white text-[#5A5A40] shadow-sm" : "text-[#5A5A40]/60 hover:text-[#5A5A40]"
                )}
              >
                <Mail size={15} />
                E-mail
              </button>
              <button
                type="button"
                onClick={() => setActiveChannel('whatsapp')}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2",
                  activeChannel === 'whatsapp' ? "bg-white text-[#5A5A40] shadow-sm" : "text-[#5A5A40]/60 hover:text-[#5A5A40]"
                )}
              >
                <MessageSquare size={15} />
                WhatsApp
              </button>
            </div>

            {/* Placeholder Quick Reference Info Badge */}
            <div className="bg-amber-50/50 border border-amber-100/70 p-4 rounded-2xl text-[11px] text-[#5A5A40]/80">
              <div className="font-bold flex items-center gap-1 text-[#C49B2A] mb-1">
                <Info size={14} />
                Dica técnica: Variáveis Dinâmicas
              </div>
              <p className="mb-2 leading-relaxed">Use estes marcadores no texto para herdar e extrair dados automaticamente do Lote/PAC do Ensaio:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono">
                <span className="bg-white px-1.5 py-0.5 rounded border border-gray-100">{"{pac_nome}"}</span>
                <span className="bg-white px-1.5 py-0.5 rounded border border-gray-100">{"{cnpj}"}</span>
                <span className="bg-white px-1.5 py-0.5 rounded border border-gray-100">{"{total_ensaios}"}</span>
                <span className="bg-white px-1.5 py-0.5 rounded border border-gray-100">{"{erros_encontrados}"}</span>
                <span className="bg-white px-1.5 py-0.5 rounded border border-gray-100">{"{percentual_erro}"}</span>
                <span className="bg-white px-1.5 py-0.5 rounded border border-gray-100">{"{placas_nao_conformes}"}</span>
              </div>
            </div>

            {/* CHANNEL FORM DEFINITIONS */}
            <div className="space-y-4">
              
              {/* 1. Oficio Fields Form */}
              {activeChannel === 'oficio' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-[#5A5A40]">Título da Notificação</label>
                    <input 
                      type="text"
                      className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl text-sm font-semibold"
                      value={oficioTitle}
                      onChange={e => setOficioTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-[#5A5A40]">Cabeçalho do Processo</label>
                    <textarea 
                      rows={2}
                      className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl text-sm font-semibold resize-none"
                      value={oficioProcessHeader}
                      onChange={e => setOficioProcessHeader(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-[#5A5A40]">Texto de Abertura / Introdução</label>
                    <textarea 
                      rows={2}
                      className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl text-sm font-semibold resize-none"
                      value={oficioIntro}
                      onChange={e => setOficioIntro(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-[#5A5A40]">Assinatura Padrão do Ofício</label>
                    <select
                      className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl text-sm font-semibold cursor-pointer"
                      value={oficioSignatureId}
                      onChange={e => setOficioSignatureId(e.target.value)}
                    >
                      <option value="">(Sem assinatura - Texto padrão de emissão eletrônica)</option>
                      {signatures.map((sig: any) => (
                        <option key={sig.id} value={sig.id}>
                          {sig.name} ({sig.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-4 pt-2">
                    <label className="text-xs font-bold uppercase text-[#5A5A40] block">Campos de Seção Editáveis (Layout da Imagem)</label>
                    
                    {oficioSections.map((section, idx) => (
                      <div key={section.id} className="p-4 bg-[#f5f5f0]/40 rounded-2xl border border-[#e5e5e0] space-y-3">
                        <div className="flex flex-col sm:flex-row gap-3 justify-between">
                          
                          {/* Title edit */}
                          <div className="flex-1">
                            <input 
                              type="text"
                              className="font-bold text-xs uppercase bg-white border border-[#e5e5e0] rounded-lg px-2.5 py-1 text-[#1a1a1a]"
                              value={section.title}
                              onChange={e => handleSectionTitleChange(section.id, e.target.value)}
                            />
                          </div>

                          {/* Icon customized selection with provide icon options */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-gray-400">Alterar Ícone:</span>
                            <div className="flex gap-1 overflow-x-auto p-1 bg-white border border-[#e5e5e0] rounded-lg">
                              {AVAILABLE_ICONS.map(ic => {
                                const IconComp = ic.icon;
                                const isSelected = section.icon === ic.id;
                                return (
                                  <button
                                    key={ic.id}
                                    type="button"
                                    onClick={() => handleIconChange(section.id, ic.id)}
                                    title={ic.name}
                                    className={cn(
                                      "p-1 rounded transition-colors",
                                      isSelected ? "bg-[#5A5A40] text-white" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                                    )}
                                  >
                                    <IconComp size={13} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                        </div>

                        {/* Content text */}
                        <textarea
                          rows={4}
                          className="w-full p-3 bg-white border border-[#e5e5e0] rounded-xl text-xs leading-relaxed focus:ring-1 focus:ring-[#5A5A40]/20"
                          value={section.content}
                          onChange={e => handleSectionContentChange(section.id, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Email Fields Form */}
              {activeChannel === 'email' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-[#5A5A40]">Assunto do E-mail</label>
                    <input 
                      type="text"
                      className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl text-sm font-semibold"
                      value={emailSubject}
                      onChange={e => setEmailSubject(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-[#5A5A40]">Conteúdo / Corpo do E-mail</label>
                    <textarea 
                      rows={12}
                      className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl text-sm font-semibold"
                      value={emailBody}
                      onChange={e => setEmailBody(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* 3. Whatsapp Fields Form */}
              {activeChannel === 'whatsapp' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-[#5A5A40]">Mensagem de WhatsApp</label>
                  <p className="text-[11px] text-gray-400 mb-2">Use formatações nativas do WhatsApp como asteriscos de negrito (*texto*) e quebras de linha.</p>
                  <textarea 
                    rows={12}
                    className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl text-sm font-semibold font-mono"
                    value={whatsappTemplate}
                    onChange={e => setWhatsappTemplate(e.target.value)}
                  />
                </div>
              )}

            </div>

            {/* Save Button */}
            <div className="flex gap-3 justify-end items-center pt-2">
              {saveSuccess && (
                <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 py-1 px-3 rounded-lg border border-emerald-100">
                  <Check size={14} /> Modelos atualizados com sucesso!
                </span>
              )}
              <button
                onClick={handleSaveTemplates}
                disabled={isSaving}
                className="bg-[#5A5A40] text-white hover:bg-[#4a4a30] transition-colors py-3 px-8 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                Salvar Configurações de Modelos
              </button>
            </div>

          </div>

          {/* RIGHT SIDE: Interactive Real-time HTML Preview (xl:col-span-5) */}
          <div className="xl:col-span-5 space-y-6">
            
            <div className="bg-[#f5f5f0] p-5 rounded-[28px] space-y-4">
              
              <div className="flex items-center justify-between border-b border-gray-200/55 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#5A5A40] flex items-center gap-1">
                  <RefreshCw size={14} className="text-gray-400" />
                  Visualização em Tempo Real
                </span>
                
                {/* Simulated / Real PAC filter to extract relations */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 font-semibold">Usar PAC:</span>
                  <select 
                    className="text-[11px] font-bold p-1 border-none rounded bg-white text-[#5A5A40]"
                    value={selectedPacId}
                    onChange={e => setSelectedPacId(e.target.value)}
                  >
                    <option value="sample-pac">Exemplo (SEA METALÚRGICA)</option>
                    {pacs.map(p => (
                      <option key={p.id} value={p.id}>{p.name.slice(0, 18)}...</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons: Download PDF and Copy Text */}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={copyToClipboard}
                  className="bg-white hover:bg-gray-100 transition-colors border border-gray-200 p-2.5 rounded-xl text-xs font-bold text-[#5A5A40] flex items-center gap-1"
                >
                  {copiedText ? (
                    <>
                      <Check size={14} className="text-emerald-600" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      Copiar Texto
                    </>
                  )}
                </button>
                {activeChannel === 'oficio' && (
                  <button
                    onClick={handlePrintPDF}
                    className="bg-[#5A5A40] hover:bg-[#4a4a30] transition-colors text-white py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm"
                  >
                    <Printer size={14} />
                    Exportar PDF
                  </button>
                )}
              </div>

              {/* LIVE EMBEDDED CONTEXT RENDERS */}
              {activeChannel === 'oficio' ? (
                // Ofício high fidelity document emulation
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm font-sans text-xs space-y-4 max-h-[600px] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo IPEM-PR" className="max-h-[32px] w-auto object-contain font-bold text-[#5A5A40]" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="font-bold text-xs bg-gray-100 border border-gray-300 py-0.5 px-1.5 rounded text-[#5A5A40]">IPEM-PR</span>
                      )}
                      <div className="text-[8px] text-gray-400 font-bold leading-tight">IPEM-PR</div>
                    </div>
                    <div className="text-right">
                      <h4 className="font-bold text-[9px] text-[#4a4a30] leading-none">{renderTemplateText(oficioTitle)}</h4>
                      <code className="text-[8px] font-bold text-gray-400 bg-gray-50 px-1 border border-gray-100 rounded inline-block mt-1 font-mono">{renderTemplateText(oficioProcessHeader)}</code>
                    </div>
                  </div>

                  <p className="text-gray-500 font-medium leading-relaxed">{renderTemplateText(oficioIntro)}</p>

                  <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                    <strong className="text-gray-700">EMPRESA NOTIFICADA:</strong> {metrics.pacName}<br/>
                    <strong className="text-gray-700">ID / CNPJ:</strong> {metrics.cnpj}
                  </div>

                  <div className="space-y-4 mt-2">
                    {oficioSections.map(s => {
                      const IconComponent = getIconComponent(s.icon);
                      const processedContent = renderTemplateText(s.content);
                      return (
                        <div key={s.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="p-2 bg-gray-100 border border-gray-200 rounded-xl text-gray-600">
                              <IconComponent size={14} />
                            </div>
                            <div className="w-0.5 bg-gray-100 flex-1 min-h-[14px]"></div>
                          </div>
                          <div className="flex-1 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                            <h5 className="font-bold text-[10px] text-gray-900 tracking-wider mb-1 text-uppercase">{s.title}</h5>
                            <p className="text-gray-600 leading-relaxed text-[11px] whitespace-pre-wrap">{processedContent}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Representative Signature Block inside live preview */}
                  <div className="pt-4 border-t border-gray-100 flex flex-col items-center text-center mt-6">
                    {selectedSignatureObj ? (
                      <div className="flex flex-col items-center">
                        <img 
                          src={selectedSignatureObj.imageUrl} 
                          alt="Assinatura" 
                          className="max-h-[50px] w-auto object-contain mb-1" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="w-[180px] border-t border-gray-200 mt-1 pt-1">
                          <h5 className="font-bold text-[10px] text-gray-800 leading-tight">
                            {selectedSignatureObj.name}
                          </h5>
                          <p className="text-[8px] text-gray-400 uppercase tracking-wider font-mono mt-0.5">
                            {selectedSignatureObj.role}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[9px] text-gray-400 italic">
                        Documento assinado eletronicamente pelo Sistema de Recebimento de Lotes IPEM-PR.
                      </div>
                    )}
                  </div>
                </div>
              ) : activeChannel === 'email' ? (
                // Email container simulation
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm text-xs overflow-hidden">
                  <div className="bg-gray-100 p-3.5 border-b border-gray-200 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-400 text-[10px] uppercase w-12">Para:</span>
                      <span className="font-medium bg-gray-200/60 px-1.5 rounded">contato@{metrics.pacName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'pac'}.com.br</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-400 text-[10px] uppercase w-12">Assunto:</span>
                      <span className="font-bold text-gray-800">{renderTemplateText(emailSubject)}</span>
                    </div>
                  </div>
                  <div className="p-4 space-y-4 max-h-[350px] overflow-y-auto bg-gray-50/20 font-sans leading-relaxed text-[#1a1a1a] whitespace-pre-wrap">
                    {renderTemplateText(emailBody)}
                  </div>
                </div>
              ) : (
                // WhatsApp window viewport simulation
                <div className="bg-[#efeae2] rounded-2xl border border-gray-300 shadow-md font-sans text-xs overflow-hidden max-w-sm mx-auto">
                  <div className="bg-[#075e54] p-3 flex items-center text-white gap-2">
                    <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold">IP</div>
                    <div>
                      <h4 className="font-bold text-[11px] leading-tight">IPEM-PR Notificações</h4>
                      <p className="text-[8px] opacity-70">Conta Comercial</p>
                    </div>
                  </div>
                  <div className="p-4 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat min-h-[300px] flex flex-col justify-end">
                    <div className="bg-[#dcf8c6] p-3 rounded-xl border border-gray-200 shadow-sm self-end max-w-[90%] text-gray-800 leading-relaxed whitespace-pre-wrap text-[11px]">
                      {renderTemplateText(whatsappTemplate)}
                      <div className="text-[8px] text-gray-400 text-right mt-1.5 font-mono">
                        {new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})} ✓✓
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
