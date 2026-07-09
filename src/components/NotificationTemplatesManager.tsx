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
  Printer,
  Settings
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
  setPacs?: React.Dispatch<React.SetStateAction<any[]>>;
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
  setPacs,
  nonConformityRecords,
  nonConformitiesConfigs,
  logoUrl = '',
  signatures = []
}: NotificationTemplatesManagerProps) {
  
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [activeChannel, setActiveChannel] = useState<'oficio' | 'email' | 'whatsapp'>('oficio');
  const [selectedPacId, setSelectedPacId] = useState<string>('sample-pac');
  
  // PAC Inline Editing states
  const [pacEditName, setPacEditName] = useState('');
  const [pacEditRazaoSocial, setPacEditRazaoSocial] = useState('');
  const [pacEditCnpj, setPacEditCnpj] = useState('');
  const [isSavingPac, setIsSavingPac] = useState(false);
  const [pacSaveSuccess, setPacSaveSuccess] = useState(false);

  useEffect(() => {
    if (selectedPacId === 'sample-pac') {
      setPacEditName('SEA METALÚRGICA');
      setPacEditRazaoSocial('SEA METALÚRGICA LTDA');
      setPacEditCnpj('02.943.486/0001-70');
    } else {
      const pacObj = pacs.find(p => p.id === selectedPacId || p.name === selectedPacId);
      if (pacObj) {
        setPacEditName(pacObj.name || '');
        setPacEditRazaoSocial(pacObj.razaoSocial || pacObj.name || '');
        setPacEditCnpj(pacObj.cnpj || '');
      }
    }
  }, [selectedPacId, pacs]);

  // Local template editor states
  const [oficioTitle, setOficioTitle] = useState('NOTIFICAÇÃO DE AUTUAÇÃO');
  const [oficioSignatureId, setOficioSignatureId] = useState<string>('');
  const [oficioProcessHeader, setOficioProcessHeader] = useState('Processo IPEM-PR 52603.000007/2026-31\nde 02 de julho de 2026.');
  const [oficioIntro, setOficioIntro] = useState('O Instituto de Pesos e Medidas do Paraná - IPEM-PR abriu um processo administrativo contra:');
  const [oficioSections, setOficioSections] = useState<any[]>([
    { id: '1', icon: 'search', title: 'MOTIVO', content: 'Identificamos irregularidades técnicas ou administrativas nos lotes sob vossa responsabilidade:\n\nRelação de Lotes Envolvidos:\n{lotes_detalhes}\n\nNo total acumulado, composto de {total_ensaios} ensaios, identificamos {erros_encontrados} desvios, o que corresponde a um percentual de irregularidade de {percentual_erro}%.\n\nRelação de placas com não-conformidades encontradas:\n{placas_nao_conformes}' },
    { id: '2', icon: 'check-square', title: 'COMO SE DEFENDER?', content: 'Você poderá apresentar a defesa por escrito em até 10(dez) dias, contados da data de recebimento desta notificação. Na defesa, informe:\n\n1. Nome do órgão que o notificou: IPEM-PR;\n2. Nome, CPF/CNPJ e assinatura;\n3. Número do Processo e do(s) Auto(s) de Infração;\n4. Motivo da defesa detalhado.' },
    { id: '3', icon: 'alert-triangle', title: 'IMPORTANTE', content: 'Você deve enviar uma cópia do seu documento de identificação oficial junto com a defesa. E se você estiver representado por procurador legal, não esqueça de encaminhar a procuração.' },
    { id: '4', icon: 'send', title: 'PARA ONDE ENVIAR?', content: 'Envie sua defesa para o IPEM-PR, localizado em Curitiba, na Rua Estados Unidos, 1354, bairro Bacacheri, CEP 82510-050.' },
    { id: '5', icon: 'help-circle', title: 'DÚVIDAS?', content: 'Envie e-mail para ouvidoria@ipem.pr.gov.br ou entre em contato pelo telefone (41) 3251-2200.' }
  ]);

  const [emailSubject, setEmailSubject] = useState('Notificação Urgente de Irregularidade - {razao_social}');
  const [emailBody, setEmailBody] = useState('Prezados,\n\nConstatamos não-conformidades nos lotes da empresa {razao_social}.\n\nDetalhes dos Lotes Envolvidos:\n{lotes_detalhes}\n\nEnquadramento Legal:\n{motivo_detalhes}\n\nReiteramos que o percentual de falhas detectadas foi de {percentual_erro}%. Verifique as instruções abaixo para apresentar a defesa prévia em até 10 dias corridos.\n\nAtenciosamente,\nIPEM-PR.');

  const [whatsappTemplate, setWhatsappTemplate] = useState('⚠️ *NOTIFICAÇÃO DE AUTUAÇÃO - IPEM-PR*\n\nInformamos que foi aberto o processo administrativo para a empresa *{razao_social}* devido a desvios e atrasos encontrados nos ensaios.\n\n📦 *Lotes Envolvidos:*\n{lotes_detalhes}\n\n*Índice de Irregularidades:* {percentual_erro}% ({erros_encontrados} desvios de {total_ensaios} ensaios).\n\n📄 *Placas Não-Conformes:* \n{placas_nao_conformes}\n\n⚖️ *Como se defender?*\nVocê possui até 10 dias úteis para apresentar recurso formalizado por escrito para o IPEM-PR, contendo justificativas, documento de identificação e procuração (caso aplicável).\n\nDúvidas: ouvidoria@ipem.pr.gov.br ou (41) 3251-2200.');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Notification Rules edit states
  const [ruleActive, setRuleActive] = useState(false);
  const [validadeMeses, setValidadeMeses] = useState(6);
  const [criterioAActive, setCriterioAActive] = useState(false);
  const [criterioANcId, setCriterioANcId] = useState('');
  const [criterioALimite, setCriterioALimite] = useState(10);
  const [criterioBActive, setCriterioBActive] = useState(false);
  const [criterioBNcId, setCriterioBNcId] = useState('');
  const [criterioBLimite, setCriterioBLimite] = useState(15);
  const [operadorLogico, setOperadorLogico] = useState<'E' | 'OU'>('OU');
  const [limiteNotificacoes, setLimiteNotificacoes] = useState(2);
  const [proximoNivelTypeId, setProximoNivelTypeId] = useState('');
  const [regraAtrasoAtiva, setRegraAtrasoAtiva] = useState(false);
  const [regraAtrasoNcId, setRegraAtrasoNcId] = useState('');
  const [regraAtrasoLimiteRepeticoes, setRegraAtrasoLimiteRepeticoes] = useState(4);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [saveRuleSuccess, setSaveRuleSuccess] = useState(false);

  // Helper for formatting CNPJ
  const formatCNPJ = (value: string) => {
    const digits = value.replace(/\D/g, '').substring(0, 14);
    let res = digits;
    if (digits.length > 12) {
      res = `${digits.substring(0, 2)}.${digits.substring(2, 5)}.${digits.substring(5, 8)}/${digits.substring(8, 12)}-${digits.substring(12)}`;
    } else if (digits.length > 8) {
      res = `${digits.substring(0, 2)}.${digits.substring(2, 5)}.${digits.substring(5, 8)}/${digits.substring(8)}`;
    } else if (digits.length > 5) {
      res = `${digits.substring(0, 2)}.${digits.substring(2, 5)}.${digits.substring(5)}`;
    } else if (digits.length > 2) {
      res = `${digits.substring(0, 2)}.${digits.substring(2)}`;
    }
    return res;
  };

  const handleSavePacInline = async () => {
    if (!selectedPacId || selectedPacId === 'sample-pac') return;
    setIsSavingPac(true);
    setPacSaveSuccess(false);

    try {
      if (isLocalMode) {
        if (setPacs) {
          const updated = pacs.map(p => 
            (p.id === selectedPacId || p.name === selectedPacId)
              ? { ...p, name: pacEditName, razaoSocial: pacEditRazaoSocial, cnpj: pacEditCnpj }
              : p
          ).sort((a, b) => a.name.localeCompare(b.name));
          setPacs(updated);
          localStorage.setItem('lotes_pacs', JSON.stringify(updated));
        }
      } else {
        const pacObj = pacs.find(p => p.id === selectedPacId || p.name === selectedPacId);
        if (pacObj && pacObj.id) {
          await updateDoc(doc(db, 'pacs', pacObj.id), {
            name: pacEditName,
            razaoSocial: pacEditRazaoSocial,
            cnpj: pacEditCnpj
          });
          if (setPacs) {
            const updated = pacs.map(p => 
              p.id === pacObj.id
                ? { ...p, name: pacEditName, razaoSocial: pacEditRazaoSocial, cnpj: pacEditCnpj }
                : p
            );
            setPacs(updated);
          }
        }
      }
      setPacSaveSuccess(true);
      setTimeout(() => setPacSaveSuccess(false), 3000);
    } catch (e: any) {
      handleFirestoreError(e, 'update', `pacs/${selectedPacId}`);
    } finally {
      setIsSavingPac(false);
    }
  };

  // Load selected template values and rule values
  useEffect(() => {
    if (selectedTypeId) {
      const selectedType = notificationTypes.find(t => t.id === selectedTypeId);
      if (selectedType) {
        // Load templates
        if (selectedType.templates) {
          const t = selectedType.templates;
          if (t.oficio) {
            setOficioTitle(t.oficio.title || 'NOTIFICAÇÃO DE AUTUAÇÃO');
            setOficioProcessHeader(t.oficio.processHeader || 'Processo IPEM-PR 52603.000007/2026-31\nde 02 de julho de 2026.');
            setOficioIntro(t.oficio.intro || '');
            setOficioSections(t.oficio.sections || []);
            setOficioSignatureId(t.oficio.signatureId || '');
          } else {
            resetTemplatesToDefault();
          }
          if (t.email) {
            setEmailSubject(t.email.subject || '');
            setEmailBody(t.email.body || '');
          }
          if (t.whatsapp) {
            setWhatsappTemplate(t.whatsapp.template || '');
          }
        } else {
          resetTemplatesToDefault();
        }

        // Load rules
        if (selectedType.rule) {
          const r = selectedType.rule;
          setRuleActive(r.active ?? false);
          setValidadeMeses(r.validadeMeses ?? 6);
          setCriterioAActive(r.criterioA_ativo ?? false);
          setCriterioANcId(r.criterioA_ncId ?? '');
          setCriterioALimite(r.criterioA_limite ?? 10);
          setCriterioBActive(r.criterioB_ativo ?? false);
          setCriterioBNcId(r.criterioB_ncId ?? '');
          setCriterioBLimite(r.criterioB_limite ?? 15);
          setOperadorLogico(r.operadorLogico ?? 'OU');
          setLimiteNotificacoes(r.limiteNotificacoes ?? 2);
          setProximoNivelTypeId(r.proximoNivel_typeId ?? '');
          setRegraAtrasoAtiva(r.regraAtraso_ativa ?? false);
          setRegraAtrasoNcId(r.regraAtraso_ncId ?? '');
          setRegraAtrasoLimiteRepeticoes(r.regraAtraso_limiteRepeticoes ?? 4);
        } else {
          resetRulesToDefault();
        }
      }
    }
  }, [selectedTypeId, notificationTypes]);

  const resetTemplatesToDefault = () => {
    setOficioTitle('NOTIFICAÇÃO DE AUTUAÇÃO');
    setOficioProcessHeader('Processo IPEM-PR 52603.000007/2026-31\nde 02 de julho de 2026.');
    setOficioIntro('O Instituto de Pesos e Medidas do Paraná - IPEM-PR abriu um processo administrativo contra:');
    setOficioSections([
      { id: '1', icon: 'search', title: 'MOTIVO', content: 'Identificamos irregularidades técnicas ou administrativas nos lotes sob vossa responsabilidade:\n\nRelação de Lotes Envolvidos:\n{lotes_detalhes}\n\nNo total acumulado, composto de {total_ensaios} ensaios, identificamos {erros_encontrados} desvios, o que corresponde a um percentual de irregularidade de {percentual_erro}%.\n\nRelação de placas com não-conformidades encontradas:\n{placas_nao_conformes}' },
      { id: '2', icon: 'check-square', title: 'COMO SE DEFENDER?', content: 'Você poderá apresentar a defesa por escrito em até 10(dez) dias, contados da data de recebimento desta notificação. Na defesa, informe:\n\n1. Nome do órgão que o notificou: IPEM-PR;\n2. Nome, CPF/CNPJ e assinatura;\n3. Número do Processo e do(s) Auto(s) de Infração;\n4. Motivo da defesa detalhado.' },
      { id: '3', icon: 'alert-triangle', title: 'IMPORTANTE', content: 'Você deve enviar uma cópia do seu documento de identificação oficial junto com a defesa. E se você estiver representado por procurador legal, não esqueça de encaminhar a procuração.' },
      { id: '4', icon: 'send', title: 'PARA ONDE ENVIAR?', content: 'Envie sua defesa para o IPEM-PR, localizado em Curitiba, na Rua Estados Unidos, 1354, bairro Bacacheri, CEP 82510-050.' },
      { id: '5', icon: 'help-circle', title: 'DÚVIDAS?', content: 'Envie e-mail para ouvidoria@ipem.pr.gov.br ou entre em contato pelo telefone (41) 3251-2200.' }
    ]);
    setEmailSubject('Notificação Urgente de Irregularidade - {razao_social}');
    setEmailBody('Prezados,\n\nConstatamos não-conformidades nos lotes da empresa {razao_social}.\n\nDetalhes dos Lotes Envolvidos:\n{lotes_detalhes}\n\nEnquadramento Legal:\n{motivo_detalhes}\n\nReiteramos que o percentual de falhas detectadas foi de {percentual_erro}%. Verifique as instruções abaixo para apresentar a defesa prévia em até 10 dias corridos.\n\nAtenciosamente,\nIPEM-PR.');
    setWhatsappTemplate('⚠️ *NOTIFICAÇÃO DE AUTUAÇÃO - IPEM-PR*\n\nInformamos que foi aberto o processo administrativo para a empresa *{razao_social}* devido a desvios e atrasos encontrados nos ensaios.\n\n📦 *Lotes Envolvidos:*\n{lotes_detalhes}\n\n*Índice de Irregularidades:* {percentual_erro}% ({erros_encontrados} desvios de {total_ensaios} ensaios).\n\n📄 *Placas Não-Conformes:* \n{placas_nao_conformes}\n\n⚖️ *Como se defender?*\nVocê possui até 10 dias úteis para apresentar recurso formalizado por escrito para o IPEM-PR, contendo justificativas, documento de identificação e procuração (caso aplicável).\n\nDúvidas: ouvidoria@ipem.pr.gov.br ou (41) 3251-2200.');
    setOficioSignatureId('');
  };

  const resetRulesToDefault = () => {
    setRuleActive(false);
    setValidadeMeses(6);
    setCriterioAActive(false);
    setCriterioANcId('');
    setCriterioALimite(10);
    setCriterioBActive(false);
    setCriterioBNcId('');
    setCriterioBLimite(15);
    setOperadorLogico('OU');
    setLimiteNotificacoes(2);
    setProximoNivelTypeId('');
    setRegraAtrasoAtiva(false);
    setRegraAtrasoNcId('');
    setRegraAtrasoLimiteRepeticoes(4);
  };

  // Handle saving the edited rules properties
  const handleSaveRule = async () => {
    if (!selectedTypeId) return;
    setIsSavingRule(true);
    setSaveRuleSuccess(false);

    const rule = {
      active: ruleActive,
      validadeMeses: Number(validadeMeses),
      criterioA_ativo: criterioAActive,
      criterioA_ncId: criterioANcId,
      criterioA_limite: Number(criterioALimite),
      criterioB_ativo: criterioBActive,
      criterioB_ncId: criterioBNcId,
      criterioB_limite: Number(criterioBLimite),
      operadorLogico,
      limiteNotificacoes: Number(limiteNotificacoes),
      proximoNivel_typeId: proximoNivelTypeId,
      regraAtraso_ativa: regraAtrasoAtiva,
      regraAtraso_ncId: regraAtrasoNcId,
      regraAtraso_limiteRepeticoes: Number(regraAtrasoLimiteRepeticoes)
    };

    try {
      if (isLocalMode) {
        const updated = notificationTypes.map(t => {
          if (t.id === selectedTypeId) {
            return { ...t, rule };
          }
          return t;
        });
        setNotificationTypes(updated);
        localStorage.setItem('lotes_notification_types', JSON.stringify(updated));
      } else {
        await updateDoc(doc(db, 'notification_types', selectedTypeId), { rule });
        const updated = notificationTypes.map(t => t.id === selectedTypeId ? { ...t, rule } : t);
        setNotificationTypes(updated);
      }
      setSaveRuleSuccess(true);
      setTimeout(() => setSaveRuleSuccess(false), 3000);
    } catch (e: any) {
      handleFirestoreError(e, 'update', `notification_types/${selectedTypeId}`);
    } finally {
      setIsSavingRule(false);
    }
  };

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
        razaoSocial: 'SEA METALÚRGICA LTDA',
        cnpj: '02.943.486/0001-70',
        totalEnsaios: 15,
        errosEncontrados: 6,
        percentualErro: '40.00',
        placasNaoConformesList: 'ABC1C34 (Placa não cadastrada), XYZ9O87 (Lacre rompido), KKK4J12 (Placa não cadastrada)',
        enquadramentos: 'Artigo 12, item II da Portaria 48/INMETRO.',
        processo: 'IMETRO-SC 52603.000007/2026-31',
        lotesDetalhes: `• Lote de Referência: LOTE-SEA-091\n  - Período do Lote: 01/06/2026 a 10/06/2026\n  - Número de Ensaios do Lote: 8\n  - Data do Recebimento do Lote: 11/06/2026\n  - Descrição da Irregularidade: Desvios em placas: Placa não cadastrada (Placas: ABC1C34, KKK4J12); Lacre rompido (Placas: XYZ9O87)\n\n• Lote de Referência: LOTE-SEA-092\n  - Período do Lote: 11/06/2026 a 20/06/2026\n  - Número de Ensaios do Lote: 7\n  - Data do Recebimento do Lote: 25/06/2026\n  - Descrição da Irregularidade: Entrega fora do prazo (Irregularidade administrativa no conjunto do lote)`
      };
    }

    const pacObj = pacs.find(p => p.id === selectedPacId || p.name === selectedPacId);
    if (!pacObj) {
      return {
        pacName: 'PAC Desconhecido',
        razaoSocial: 'PAC Desconhecido',
        cnpj: '00.000.000/0000-00',
        totalEnsaios: 0,
        errosEncontrados: 0,
        percentualErro: '0.00',
        placasNaoConformesList: '(Nenhuma placa não-conforme vinculada)',
        enquadramentos: 'Nenhum',
        processo: 'IMETRO-SC',
        lotesDetalhes: '(Nenhum lote irregular)'
      };
    }

    // Filter batches for this PAC with nonConformities
    const pacBatches = batches.filter(b => b.pac === pacObj.name || b.pac === pacObj.id);
    let totalEnsaios = 0;
    const nonConformingPlates: string[] = [];
    const groundsUnique = new Set<string>();
    const lotesList: string[] = [];

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

    pacBatches.forEach((b, idx) => {
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

      const isAtrasado = b.ensaioForaDoPrazo === true;
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

    const totalErros = nonConformingPlates.length;
    const percent = totalEnsaios > 0 ? ((totalErros / totalEnsaios) * 100).toFixed(2) : '0.00';
    const lotesDetalhesString = lotesList.length > 0 
      ? lotesList.join('\n\n') 
      : '(Nenhum lote irregular ou entregue fora do prazo foi identificado para este PAC)';

    return {
      pacName: pacObj.name,
      razaoSocial: pacObj.razaoSocial || pacObj.name,
      cnpj: pacObj.cnpj || '02.943.486/0001-70', // mock if not present
      totalEnsaios,
      errosEncontrados: totalErros,
      percentualErro: percent,
      placasNaoConformesList: nonConformingPlates.join(', ') || '(Nenhuma placa encontrada)',
      enquadramentos: Array.from(groundsUnique).join(', ') || 'Sem enquadramentos',
      processo: `IMETRO-SC 52603.000${selectedPacId.slice(-3) || '999'}/2026-31`,
      lotesDetalhes: lotesDetalhesString
    };
  };

  const metrics = getSelectedPacMetrics();

  // Helper function to replace templates parameters
  const renderTemplateText = (text: string) => {
    if (!text) return '';
    return text
      .replace(/{pac_nome}/g, metrics.pacName)
      .replace(/{razao_social}/g, metrics.razaoSocial)
      .replace(/{cnpj}/g, metrics.cnpj)
      .replace(/{total_ensaios}/g, String(metrics.totalEnsaios))
      .replace(/{erros_encontrados}/g, String(metrics.errosEncontrados))
      .replace(/{percentual_erro}/g, metrics.percentualErro)
      .replace(/{placas_nao_conformes}/g, metrics.placasNaoConformesList)
      .replace(/{motivo_detalhes}/g, metrics.enquadramentos)
      .replace(/{lotes_detalhes}/g, metrics.lotesDetalhes || '')
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
                display: block !important;
              }
              .no-print { display: none !important; }
              .print-avoid-break, .target-box, .section-item { 
                page-break-inside: avoid !important; 
                break-inside: avoid !important;
              }
              .header {
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
            <strong>EMPRESA NOTIFICADA:</strong> ${metrics.razaoSocial || metrics.pacName}<br/>
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
            <div className="bg-amber-50/50 border border-amber-100/70 p-4 rounded-2xl text-[11px] text-[#5A5A40]/80 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-[#C49B2A]">
                <Info size={15} />
                Guia de Variáveis Dinâmicas
              </div>
              <p className="leading-relaxed text-gray-600">
                Utilize as variáveis abaixo para automatizar o preenchimento de dados de ensaios e do PAC nos modelos de notificação:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 bg-white/70 px-2 py-1.5 rounded-xl border border-amber-100/40">
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{"{razao_social}"}</span>
                  <span className="text-gray-500 text-[10px]">Razão Social da empresa</span>
                </div>
                <div className="flex items-center gap-2 bg-white/70 px-2 py-1.5 rounded-xl border border-amber-100/40">
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{"{pac_nome}"}</span>
                  <span className="text-gray-500 text-[10px]">Nome Amigável do PAC</span>
                </div>
                <div className="flex items-center gap-2 bg-white/70 px-2 py-1.5 rounded-xl border border-amber-100/40">
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{"{cnpj}"}</span>
                  <span className="text-gray-500 text-[10px]">CNPJ do PAC</span>
                </div>
                <div className="flex items-center gap-2 bg-white/70 px-2 py-1.5 rounded-xl border border-amber-100/40">
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{"{total_ensaios}"}</span>
                  <span className="text-gray-500 text-[10px]">Total de ensaios</span>
                </div>
                <div className="flex items-center gap-2 bg-white/70 px-2 py-1.5 rounded-xl border border-amber-100/40">
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{"{erros_encontrados}"}</span>
                  <span className="text-gray-500 text-[10px]">Total de desvios</span>
                </div>
                <div className="flex items-center gap-2 bg-white/70 px-2 py-1.5 rounded-xl border border-amber-100/40">
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{"{percentual_erro}"}</span>
                  <span className="text-gray-500 text-[10px]">Índice de erro (%)</span>
                </div>
                <div className="flex items-center gap-2 bg-white/70 px-2 py-1.5 rounded-xl border border-amber-100/40 col-span-full">
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{"{lotes_detalhes}"}</span>
                  <span className="text-gray-500 text-[10px]">Relação completa de lotes com período (inicial/final), nº ensaios e recebimento</span>
                </div>
                <div className="flex items-center gap-2 bg-white/70 px-2 py-1.5 rounded-xl border border-amber-100/40">
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{"{placas_nao_conformes}"}</span>
                  <span className="text-gray-500 text-[10px]">Placas reprovadas</span>
                </div>
                <div className="flex items-center gap-2 bg-white/70 px-2 py-1.5 rounded-xl border border-amber-100/40">
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{"{motivo_detalhes}"}</span>
                  <span className="text-gray-500 text-[10px]">Enquadramentos violados</span>
                </div>
                <div className="flex items-center gap-2 bg-white/70 px-2 py-1.5 rounded-xl border border-[#C49B2A]/20 bg-amber-50/20 col-span-full">
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{"{data_atual}"}</span>
                  <span className="text-gray-500 text-[10px]">Data de hoje (DD/MM/AAAA)</span>
                </div>
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

              {/* PAC Inline Editing Section */}
              {selectedPacId && (
                <div className="bg-white/90 p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3 font-sans">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A5A40] flex items-center gap-1.5">
                      <Settings size={13} className="text-[#5A5A40]/70" />
                      Alterar Dados Cadastrais do PAC Selecionado
                    </span>
                    {selectedPacId === 'sample-pac' && (
                      <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold border border-amber-150">Temporário / Exemplo</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-500 block">Nome do PAC</label>
                      <input 
                        type="text" 
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 disabled:opacity-60"
                        value={pacEditName}
                        onChange={e => setPacEditName(e.target.value)}
                        disabled={selectedPacId === 'sample-pac'}
                        placeholder="Nome amigável"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-500 block">Razão Social</label>
                      <input 
                        type="text" 
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20"
                        value={pacEditRazaoSocial}
                        onChange={e => setPacEditRazaoSocial(e.target.value)}
                        placeholder="Razão Social"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-500 block">CNPJ</label>
                      <input 
                        type="text" 
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20"
                        value={pacEditCnpj}
                        onChange={e => setPacEditCnpj(formatCNPJ(e.target.value))}
                        placeholder="00.000.000/0000-00"
                      />
                    </div>
                  </div>

                  {selectedPacId !== 'sample-pac' ? (
                    <div className="flex justify-end gap-3 pt-1 items-center">
                      {pacSaveSuccess && (
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                          <Check size={12} /> Alterações salvas!
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleSavePacInline}
                        disabled={isSavingPac || !pacEditName.trim()}
                        className="bg-[#5A5A40] text-white hover:bg-[#4a4a30] transition-colors py-2 px-4 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        {isSavingPac ? <RefreshCw className="animate-spin" size={11} /> : <Save size={11} />}
                        Salvar Dados do PAC
                      </button>
                    </div>
                  ) : (
                    <p className="text-[9px] text-amber-600/80 italic pt-1 leading-relaxed">
                      * O PAC Exemplo é apenas para testes. Para cadastrar um PAC permanente que possa ser notificado, utilize a aba "Configurações" no painel principal do aplicativo.
                    </p>
                  )}
                </div>
              )}

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
                    <strong className="text-gray-700">EMPRESA NOTIFICADA:</strong> {metrics.razaoSocial || metrics.pacName}<br/>
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

      {/* Gerenciar Regras de Notificações Section */}
      {selectedTypeId && (
        <div id="gerenciar-regras-secao" className="mt-10 pt-10 border-t border-gray-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-display font-bold text-xl text-[#5A5A40] flex items-center gap-2">
                <Settings size={22} className="text-[#5A5A40]" />
                Gerenciar Regras de Notificações
              </h3>
              <p className="text-xs text-[#5A5A40]/60 mt-0.5">
                Defina os parâmetros de validade temporal, gatilhos de não-conformidade e regras de escalonamento para <strong>{notificationTypes.find(t => t.id === selectedTypeId)?.name}</strong>.
              </p>
            </div>
            
            <button
              type="button"
              onClick={handleSaveRule}
              disabled={isSavingRule}
              className={cn(
                "px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm shrink-0 self-start sm:self-center",
                saveRuleSuccess 
                  ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                  : "bg-[#5A5A40] text-white hover:bg-[#4a4a30]"
              )}
            >
              {isSavingRule ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              {saveRuleSuccess ? "Regra Salva!" : isSavingRule ? "Salvando..." : "Salvar Regra de Autuação"}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Status & Validity Card */}
            <div className="lg:col-span-4 bg-[#f5f5f0]/30 border border-[#e5e5e0] rounded-3xl p-5 space-y-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A5A40] border-b border-[#e5e5e0]/70 pb-2 flex items-center justify-between">
                <span>1. Cadastro e Validade</span>
                <span className="text-[10px] lowercase text-[#5A5A40]/40 font-mono">(ciclo de vida)</span>
              </h4>
              
              <div className="space-y-4">
                <label className="flex items-start gap-3 bg-white p-3.5 rounded-xl border border-[#e5e5e0] cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={ruleActive}
                    onChange={e => setRuleActive(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-[#5A5A40] border-gray-300 focus:ring-[#5A5A40]/20"
                  />
                  <div>
                    <span className="text-xs font-bold text-gray-800 block">Ativar Regra de Autuação</span>
                    <span className="text-[10px] text-gray-400 leading-tight block mt-0.5">Habilita a execução das validações pelo motor de autuação para este tipo</span>
                  </div>
                </label>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-[#5A5A40]/70">Janela de Validade (Meses)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      min="1" 
                      max="120"
                      value={validadeMeses}
                      onChange={e => setValidadeMeses(Number(e.target.value))}
                      className="w-full p-3 bg-white border border-[#e5e5e0] rounded-xl text-xs font-mono font-bold text-gray-800 focus:ring-2 focus:ring-[#5A5A40]/20"
                    />
                    <span className="absolute right-3 top-3.5 text-[10px] uppercase font-bold text-gray-400">Meses</span>
                  </div>
                  <p className="text-[10px] text-gray-400 italic leading-snug">
                    Janela temporal para validade dos lotes de ensaio (parâmetro X). Lotes cuja data de encerramento ultrapassar este prazo em relação à data atual são automaticamente desconsiderados nas consultas e cálculos.
                  </p>
                </div>
              </div>
            </div>

            {/* Trigger Criteria Card */}
            <div className="lg:col-span-8 bg-[#f5f5f0]/30 border border-[#e5e5e0] rounded-3xl p-5 space-y-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A5A40] border-b border-[#e5e5e0]/70 pb-2">
                2. Critérios de Gatilho (Análise de Não-Conformidades)
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Criterion A */}
                <div className="bg-white p-4 rounded-2xl border border-[#e5e5e0] space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none border-b border-gray-100 pb-2 mb-2">
                    <input 
                      type="checkbox" 
                      checked={criterioAActive}
                      onChange={e => setCriterioAActive(e.target.checked)}
                      className="w-4 h-4 rounded text-[#5A5A40] border-gray-300 focus:ring-[#5A5A40]/20"
                    />
                    <span className="text-xs font-bold text-[#5A5A40]">Critério A (Lote Atual)</span>
                  </label>

                  <div className={cn("space-y-3 transition-opacity", !criterioAActive && "opacity-50")}>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-400">Código de Não-Conformidade</label>
                      <select 
                        disabled={!criterioAActive}
                        value={criterioANcId}
                        onChange={e => setCriterioANcId(e.target.value)}
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                      >
                        <option value="">Qualquer Não-Conformidade (Geral)</option>
                        {nonConformitiesConfigs.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-400">Limite Mínimo de Erro (%)</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          step="0.01"
                          min="0"
                          max="100"
                          disabled={!criterioAActive}
                          value={criterioALimite}
                          onChange={e => setCriterioALimite(Number(e.target.value))}
                          className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono font-bold"
                        />
                        <span className="absolute right-3 top-2 text-xs text-gray-400">%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Criterion B */}
                <div className="bg-white p-4 rounded-2xl border border-[#e5e5e0] space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none border-b border-gray-100 pb-2 mb-2">
                    <input 
                      type="checkbox" 
                      checked={criterioBActive}
                      onChange={e => setCriterioBActive(e.target.checked)}
                      className="w-4 h-4 rounded text-[#5A5A40] border-gray-300 focus:ring-[#5A5A40]/20"
                    />
                    <span className="text-xs font-bold text-[#5A5A40]">Critério B (Histórico Soma)</span>
                  </label>

                  <div className={cn("space-y-3 transition-opacity", !criterioBActive && "opacity-50")}>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-400">Não-Conformidade Consolidada</label>
                      <select 
                        disabled={!criterioBActive}
                        value={criterioBNcId}
                        onChange={e => setCriterioBNcId(e.target.value)}
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                      >
                        <option value="">Qualquer Não-Conformidade (Erros Gerais)</option>
                        {nonConformitiesConfigs.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-gray-400">Limite Mínimo Consolidado (%)</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          step="0.01"
                          min="0"
                          max="100"
                          disabled={!criterioBActive}
                          value={criterioBLimite}
                          onChange={e => setCriterioBLimite(Number(e.target.value))}
                          className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono font-bold"
                        />
                        <span className="absolute right-3 top-2 text-xs text-gray-400">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Logical Operator */}
              {criterioAActive && criterioBActive && (
                <div className="bg-white p-4 rounded-2xl border border-dashed border-[#e5e5e0] flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in duration-200">
                  <div>
                    <span className="text-xs font-bold text-gray-800 block">Operação Lógica de Combinação</span>
                    <span className="text-[10px] text-gray-400">Combine as condições A e B para acionamento do gatilho</span>
                  </div>
                  <div className="flex bg-[#f5f5f0] p-1 rounded-xl gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setOperadorLogico('OU')}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all",
                        operadorLogico === 'OU' ? "bg-[#5A5A40] text-white shadow-xs" : "text-[#5A5A40]/60 hover:text-[#5A5A40]"
                      )}
                    >
                      OU (Qualquer um)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOperadorLogico('E')}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all",
                        operadorLogico === 'E' ? "bg-[#5A5A40] text-white shadow-xs" : "text-[#5A5A40]/60 hover:text-[#5A5A40]"
                      )}
                    >
                      E (Ambos)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Escalation Rule Card */}
          <div className="bg-[#f5f5f0]/30 border border-[#e5e5e0] rounded-3xl p-5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A5A40] border-b border-[#e5e5e0]/70 pb-2">
              3. Regra de Escalonamento e Limite de Repetição
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5 bg-white p-4 rounded-2xl border border-[#e5e5e0]">
                <label className="text-[10px] font-bold uppercase text-[#5A5A40]/70 text-gray-850 font-bold block mb-1">Limite de Repetições do Mesmo Tipo</label>
                <div className="relative">
                  <input 
                    type="number" 
                    min="1" 
                    max="50"
                    value={limiteNotificacoes}
                    onChange={e => setLimiteNotificacoes(Number(e.target.value))}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-800 focus:ring-2 focus:ring-[#5A5A40]/20"
                  />
                  <span className="absolute right-3 top-3 text-[10px] uppercase font-bold text-gray-400">Vezes</span>
                </div>
                <p className="text-[10px] text-gray-400 leading-normal mt-1">
                  Define o parâmetro X limite de repetições. O sistema conta as notificações deste tipo emitidas para o histórico consolidado. Ao atingir o limite, o motor bloqueia a reemissão e redireciona.
                </p>
              </div>

              <div className="space-y-1.5 bg-white p-4 rounded-2xl border border-[#e5e5e0]">
                <label className="text-[10px] font-bold uppercase text-[#5A5A40]/70 text-gray-850 font-bold block mb-1">Próximo Nível (Transição de Escalonamento)</label>
                <select 
                  value={proximoNivelTypeId}
                  onChange={e => setProximoNivelTypeId(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-205 rounded-xl text-xs font-semibold text-[#5A5A40] focus:ring-2 focus:ring-[#5A5A40]/20"
                >
                  <option value="">Nenhum (Nível Máximo)</option>
                  {notificationTypes.filter(t => t.id !== selectedTypeId).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 leading-normal mt-1">
                  Selecione a notificação superior na hierarquia. Quando o limite acima for alcançado, o motor buscará esta configuração para sugerir a alternativa automaticamente.
                </p>
              </div>
            </div>
          </div>

          {/* Rule 4: Delayed Assay rule */}
          <div className="bg-[#f5f5f0]/30 border border-[#e5e5e0] rounded-3xl p-5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A5A40] border-b border-[#e5e5e0]/70 pb-2 flex items-center justify-between">
              <span>4. Regra de Atraso na Entrega de Ensaios</span>
              <span className="text-[10px] lowercase text-[#5A5A40]/40 font-mono">(atraso administrativo)</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-4 bg-white p-4 rounded-2xl border border-[#e5e5e0] flex items-start gap-3">
                <input 
                  type="checkbox" 
                  checked={regraAtrasoAtiva}
                  onChange={e => setRegraAtrasoAtiva(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#5A5A40] border-gray-300 focus:ring-[#5A5A40]/20"
                />
                <div>
                  <span className="text-xs font-bold text-gray-800 block">Ativar Regra de Atraso</span>
                  <span className="text-[10px] text-gray-400 leading-snug block mt-0.5">Associa o atraso na entrega de ensaios ao motivo escolhido no desvio</span>
                </div>
              </div>

              <div className="md:col-span-4 space-y-1.5 bg-white p-4 rounded-2xl border border-[#e5e5e0]">
                <label className="text-[10px] font-bold uppercase text-[#5A5A40]/70 text-gray-800 font-bold block mb-1">Motivo de Não-Conformidade Vinculado</label>
                <select 
                  disabled={!regraAtrasoAtiva}
                  value={regraAtrasoNcId}
                  onChange={e => setRegraAtrasoNcId(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-[#5A5A40] focus:ring-2 focus:ring-[#5A5A40]/20 disabled:opacity-50"
                >
                  <option value="">Qualquer desvio (Vinculado Geral)</option>
                  {nonConformitiesConfigs.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 leading-normal mt-1">
                  Selecione o motivo de não-conformidade que será automaticamente ativado quando um lote contiver a opção "ensaio entregue fora do prazo" assinalada.
                </p>
              </div>

              <div className="md:col-span-4 space-y-1.5 bg-white p-4 rounded-2xl border border-[#e5e5e0]">
                <label className="text-[10px] font-bold uppercase text-[#5A5A40]/70 text-gray-800 font-bold block mb-1">Limite de Repetições do Mesmo Tipo (Parâmetro X)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    min="1" 
                    max="50"
                    disabled={!regraAtrasoAtiva}
                    value={regraAtrasoLimiteRepeticoes}
                    onChange={e => setRegraAtrasoLimiteRepeticoes(Number(e.target.value))}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-800 focus:ring-2 focus:ring-[#5A5A40]/20 disabled:opacity-50"
                  />
                  <span className="absolute right-3 top-3.5 text-[10px] uppercase font-bold text-gray-400">Vezes</span>
                </div>
                <p className="text-[10px] text-gray-400 leading-normal mt-1">
                  Define o parâmetro X limite de repetições. O sistema conta as notificações deste tipo emitidas para o histórico consolidado.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
