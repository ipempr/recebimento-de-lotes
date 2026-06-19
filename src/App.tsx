/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  setDoc,
  doc, 
  query, 
  orderBy, 
  Timestamp,
  getDocFromServer,
  deleteDoc,
  getDocs,
  writeBatch,
  where
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { 
  Plus, 
  Search, 
  Filter, 
  LogOut, 
  Settings, 
  ChevronRight, 
  Calendar, 
  User as UserIcon, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  AlertTriangle,
  Trash2,
  Edit3,
  X,
  Check,
  BarChart3,
  TrendingUp,
  History,
  FileSpreadsheet,
  Download,
  Upload,
  Loader2,
  ChevronDown,
  Copy,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { format, addDays, differenceInDays, isAfter, isBefore, startOfDay, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { read, utils } from 'xlsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import NotificationsPanel from './components/NotificationsPanel';
import NotificationTemplatesManager from './components/NotificationTemplatesManager';
import { SystemTutorial } from './components/SystemTutorial';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper to parse "yyyy-MM-dd" date strings into local Date objects at noon to avoid timezone timezone-shifting bugs.
function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date(dateStr);
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  return new Date(year, month - 1, day, 12, 0, 0);
}

// Types
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

interface Batch {
  id: string;
  pac: string;
  periodoInicial: Timestamp;
  periodoFinal: Timestamp;
  numEnsaios: number;
  status: string;
  recebidoPor: string;
  recebidoEm: Timestamp;
  lidoPor?: string;
  lidoEm?: Timestamp;
  conferidoPor?: string;
  conferidoEm?: Timestamp;
}

interface ConfigItem {
  id: string;
  name: string;
  color?: string;
  rule?: any;
  templates?: any;
}

class LocalTimestamp {
  seconds: number;
  nanoseconds: number;
  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  toDate() {
    return new Date(this.seconds * 1000);
  }
  toMillis() {
    return this.seconds * 1000;
  }
  isEqual(other: any) {
    return other && other.seconds === this.seconds && other.nanoseconds === this.nanoseconds;
  }
  toJSON() {
    return { seconds: this.seconds, nanoseconds: this.nanoseconds, type: 'timestamp' };
  }
  valueOf() {
    return `Timestamp(seconds=${this.seconds}, nanoseconds=${this.nanoseconds})`;
  }
  static now() {
    return new LocalTimestamp(Math.floor(Date.now() / 1000), 0);
  }
  static fromDate(date: Date) {
    return new LocalTimestamp(Math.floor(date.getTime() / 1000), 0);
  }
  static fromMillis(ms: number) {
    return new LocalTimestamp(Math.floor(ms / 1000), 0);
  }
}

function parseLocalTimestamp(raw: any): any {
  if (!raw) return null;
  if (typeof raw.toDate === 'function') return raw;
  if (typeof raw === 'object' && raw.seconds !== undefined) {
    return new LocalTimestamp(raw.seconds, raw.nanoseconds || 0);
  }
  if (typeof raw === 'string') {
    return LocalTimestamp.fromDate(new Date(raw));
  }
  if (typeof raw === 'number') {
    return LocalTimestamp.fromMillis(raw);
  }
  return LocalTimestamp.now();
}

interface AuthErrorDetails {
  code: string;
  title: string;
  message: string;
  actionHtml?: string;
}

function parseAuthError(err: any): AuthErrorDetails {
  const code = err?.code || '';
  const message = err?.message || String(err);
  
  if (code === 'auth/unauthorized-domain' || message.includes('unauthorized-domain') || message.includes('domain is not authorized')) {
    const currentDomain = window.location.hostname;
    return {
      code: 'auth/unauthorized-domain',
      title: 'Domínio Não Autorizado',
      message: `O domínio atual (${currentDomain}) não está na lista de domínios autorizados no Firebase.`,
      actionHtml: `
        <div class="mt-3 text-sm space-y-2 text-[#5a5a40]">
          <p>Para corrigir, siga os passos abaixo no seu painel do Firebase (ID do Projeto: <strong class="select-all bg-[#f5f5f0] px-1 rounded">ai-studio-applet-webapp-71b30</strong>):</p>
          <ol class="list-decimal list-inside space-y-2 pl-1 bg-[#f5f5f0] p-4 rounded-xl border border-[#e5e5e0] text-xs text-left">
            <li>Acesse o link direto do console Firebase: <br/>
              <a href="https://console.firebase.google.com/project/ai-studio-applet-webapp-71b30/authentication/settings" target="_blank" rel="noopener noreferrer" class="underline font-bold text-blue-600 hover:text-blue-800 break-all">
                Abrir Painel de Configurações
              </a>
            </li>
            <li>Encontre a seção de <strong>"Domínios autorizados"</strong> (Authorized domains).</li>
            <li>Clique em <strong>"Adicionar domínio"</strong>.</li>
            <li>Insira este domínio exatamente: <code class="bg-white border border-[#e5e5e0] px-1.5 py-0.5 rounded text-red-600 font-mono text-xs select-all font-bold">${currentDomain}</code> e clique em <strong>Adicionar</strong>.</li>
            <li>Caso precise carregar no editor ou painel de desenvolvimento, verifique se também adicionou: <br/><code class="bg-white border border-[#e5e5e0] px-1.5 py-0.5 rounded font-mono text-xs select-all font-bold">ais-dev-2wvwziemydj4o6k52si3ec-323441203869.us-east1.run.app</code>.</li>
          </ol>
          <p class="text-xs text-[#5a5a40]/80">Após realizar este passo no console do Firebase, basta atualizar esta página e tentar o login novamente!</p>
        </div>
      `
    };
  }
  
  if (code === 'auth/operation-not-allowed' || message.includes('operation-not-allowed')) {
    return {
      code: 'auth/operation-not-allowed',
      title: 'Login Google Desabilitado',
      message: 'O provedor de login com Google não foi ativado no painel de controle do Firebase.',
      actionHtml: `
        <div class="mt-3 text-sm space-y-2 text-[#5a5a40]">
          <p>Para ativar o login social:</p>
          <ol class="list-decimal list-inside space-y-2 pl-1 bg-[#f5f5f0] p-4 rounded-xl border border-[#e5e5e0] text-xs text-left">
            <li>Acesse o link: <br/>
              <a href="https://console.firebase.google.com/project/ai-studio-applet-webapp-71b30/authentication/providers" target="_blank" rel="noopener noreferrer" class="underline font-bold text-blue-600 hover:text-blue-800 break-all">
                Abrir Métodos de Login no Firebase
              </a>
            </li>
            <li>Clique em <strong>"Adicionar novo provedor"</strong> e selecione <strong>Google</strong>.</li>
            <li>Ative o provedor, selecione um <strong>e-mail de suporte</strong> do projeto e clique em <strong>Salvar</strong>.</li>
          </ol>
        </div>
      `
    };
  }

  if (code === 'auth/popup-blocked') {
    return {
      code,
      title: 'Popup Bloqueado pelo Navegador',
      message: 'A janela pop-up de login do Google foi bloqueada pelo seu navegador.',
      actionHtml: `
        <div class="mt-3 text-sm space-y-1 text-[#5a5a40] text-left">
          <p>Como resolver:</p>
          <ul class="list-disc list-inside space-y-1 pl-1 text-xs">
            <li>Procure pelo ícone de popup bloqueado na barra de endereços (geralmente no canto superior direito) e selecione <strong>Sempre permitir popups deste site</strong>.</li>
            <li>Após habilitar, tente clicar em <strong>"Entrar com Google"</strong> novamente.</li>
            <li>Ou utilize o <strong>Acesso Demonstrativo Local</strong> abaixo para usar offline!</li>
          </ul>
        </div>
      `
    };
  }

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return {
      code,
      title: 'Login Cancelado',
      message: 'A janela de login com o Google foi fechada antes de o login ser concluído.',
      actionHtml: `
        <div class="mt-3 text-sm text-[#5a5a40] text-xs text-left">
          <p>Por favor, clique em <strong>"Entrar com Google"</strong> novamente para tentar outra vez.</p>
        </div>
      `
    };
  }

  return {
    code,
    title: 'Erro de Autenticação',
    message: message || 'Não foi possível efetuar o login usando a Conta Google.',
    actionHtml: `
      <div class="mt-3 text-xs text-[#5a5a40]/90 text-left">
        <p class="font-mono text-[11px] bg-[#f5f5f0] p-2 rounded border border-[#e5e5e0] text-red-600 break-all">Código: ${code || 'Desconhecido'}<br/>Mensagem: ${message}</p>
        <p class="mt-2 text-xs">Tente novamente ou use o <strong>Acesso Demonstrativo Local</strong> para testar as funcionalidades do aplicativo imediatamente.</p>
      </div>
    `
  };
}

export default function App() {
  const [isLocalMode, setIsLocalMode] = useState(() => {
    return localStorage.getItem('lotes_isLocalMode') === 'true';
  });
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [pacs, setPacs] = useState<ConfigItem[]>([]);
  const [collaborators, setCollaborators] = useState<ConfigItem[]>([]);
  const [statuses, setStatuses] = useState<ConfigItem[]>([]);
  const [nonConformitiesConfigs, setNonConformitiesConfigs] = useState<ConfigItem[]>([]);
  const [framings, setFramings] = useState<any[]>([]);
  const [nonConformityRecords, setNonConformityRecords] = useState<any[]>([]);
  const [notificationTypes, setNotificationTypes] = useState<ConfigItem[]>([]);
  const [generatedNotifications, setGeneratedNotifications] = useState<any[]>([]);
  
  interface Signature {
    id: string;
    name: string;
    role: string;
    imageUrl: string;
  }

  const [logoUrl, setLogoUrl] = useState<string>(() => {
    return localStorage.getItem('lotes_logoUrl') || '';
  });

  const [signatures, setSignatures] = useState<Signature[]>(() => {
    try {
      const saved = localStorage.getItem('lotes_signatures');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveLogoUrl = async (newUrl: string) => {
    setLogoUrl(newUrl);
    if (newUrl) {
      localStorage.setItem('lotes_logoUrl', newUrl);
    } else {
      localStorage.removeItem('lotes_logoUrl');
    }
    if (!isLocalMode) {
      try {
        await setDoc(doc(db, 'configs', 'branding'), { logoUrl: newUrl }, { merge: true });
      } catch (err) {
        console.error("Erro ao salvar logo no Firestore:", err);
        handleFirestoreError(err, OperationType.WRITE, 'configs/branding');
      }
    }
  };

  const saveSignatures = async (newSigs: Signature[]) => {
    setSignatures(newSigs);
    localStorage.setItem('lotes_signatures', JSON.stringify(newSigs));
    if (!isLocalMode) {
      try {
        await setDoc(doc(db, 'configs', 'branding'), { signatures: newSigs }, { merge: true });
      } catch (err) {
        console.error("Erro ao salvar assinaturas no Firestore:", err);
        handleFirestoreError(err, OperationType.WRITE, 'configs/branding');
      }
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('open'); // Changed default to 'open'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'config' | 'stats' | 'notifications' | 'tutorial'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [configToDelete, setConfigToDelete] = useState<{type: string, id: string} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [googleLoginError, setGoogleLoginError] = useState<any | null>(null);

  // Dashboard Period States
  const defaultDashStart = useMemo(() => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'), []);
  const defaultDashEnd = useMemo(() => format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd'), []);

  const [dashStartDate, setDashStartDate] = useState<string>(defaultDashStart);
  const [dashEndDate, setDashEndDate] = useState<string>(defaultDashEnd);

  // Error Handler
  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    setError(`Erro na operação ${operationType}: ${errInfo.error}`);
  };

  // Auth
  useEffect(() => {
    const isLocal = localStorage.getItem('lotes_isLocalMode') === 'true';
    if (isLocal) {
      setUser({
        uid: 'client-demo',
        email: 'demo@ipempr.org',
        displayName: 'Convidado Local',
        emailVerified: true
      } as any);
      setLoading(false);
      setIsLocalMode(true);
    } else {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, []);

  const handleLogin = async () => {
    setGoogleLoginError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      setGoogleLoginError(err);
    }
  };

  const handleLocalLogin = () => {
    setIsLocalMode(true);
    localStorage.setItem('lotes_isLocalMode', 'true');
    setUser({
      uid: 'client-demo',
      email: 'demo@ipempr.org',
      displayName: 'Convidado Local',
      emailVerified: true
    } as any);
  };

  const enableLocalMode = () => {
    setIsLocalMode(true);
    localStorage.setItem('lotes_isLocalMode', 'true');
    setUser({
      uid: 'client-demo',
      email: user?.email || 'demo@ipempr.org',
      displayName: user?.displayName || 'Convidado Local',
      emailVerified: true
    } as any);
    setError(null);
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.removeItem('lotes_isLocalMode');
    setIsLocalMode(false);
    signOut(auth);
    setUser(null);
  };

  // Data Fetching
  useEffect(() => {
    if (!user) return;

    if (isLocalMode) {
      // Offline Local Mode
      const savedBatches = localStorage.getItem('lotes_batches');
      const savedPacs = localStorage.getItem('lotes_pacs');
      const savedCollabs = localStorage.getItem('lotes_collaborators');
      const savedStatuses = localStorage.getItem('lotes_statuses');

      let initialBatches: Batch[] = [];
      let initialPacs: ConfigItem[] = [];
      let initialCollabs: ConfigItem[] = [];
      let initialStatuses: ConfigItem[] = [];

      if (savedPacs) {
        initialPacs = JSON.parse(savedPacs);
      } else {
        initialPacs = [
          { id: 'p1', name: 'PAC 01 - Araucária' },
          { id: 'p2', name: 'PAC 02 - Cascavel' },
          { id: 'p3', name: 'PAC 03 - Curitiba' },
          { id: 'p4', name: 'PAC 04 - Foz do Iguaçu' },
          { id: 'p5', name: 'PAC 05 - Londrina' },
          { id: 'p6', name: 'PAC 06 - Maringá' },
          { id: 'p7', name: 'PAC 07 - Ponta Grossa' }
        ];
        localStorage.setItem('lotes_pacs', JSON.stringify(initialPacs));
      }

      if (savedCollabs) {
        initialCollabs = JSON.parse(savedCollabs);
      } else {
        initialCollabs = [
          { id: 'c1', name: 'Ana Souza' },
          { id: 'c2', name: 'Carlos Lima' },
          { id: 'c3', name: 'Gabriel Ramos' },
          { id: 'c4', name: 'Mariana Santos' },
          { id: 'c5', name: 'Paulo Henrique' },
          { id: 'c6', name: 'Renata Costa' }
        ];
        localStorage.setItem('lotes_collaborators', JSON.stringify(initialCollabs));
      }

      if (savedStatuses) {
        initialStatuses = JSON.parse(savedStatuses);
      } else {
        initialStatuses = [
          { id: 's1', name: 'ABERTO' },
          { id: 's2', name: 'ALERTA' },
          { id: 's3', name: 'ATRASO' },
          { id: 's4', name: 'EM ANDAMENTO' },
          { id: 's5', name: 'FINALIZADO' }
        ];
        localStorage.setItem('lotes_statuses', JSON.stringify(initialStatuses));
      }

      if (savedBatches) {
        const raw = JSON.parse(savedBatches);
        initialBatches = raw.map((b: any) => ({
          ...b,
          periodoInicial: parseLocalTimestamp(b.periodoInicial),
          periodoFinal: parseLocalTimestamp(b.periodoFinal),
          recebidoEm: parseLocalTimestamp(b.recebidoEm),
          lidoEm: parseLocalTimestamp(b.lidoEm),
          conferidoEm: parseLocalTimestamp(b.conferidoEm)
        }));
      } else {
        initialBatches = [
          {
            id: 'b1',
            pac: 'PAC 02 - Cascavel',
            numEnsaios: 15,
            status: 'FINALIZADO',
            recebidoPor: 'Ana Souza',
            recebidoEm: LocalTimestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 24 * 15),
            lidoPor: 'Ana Souza',
            lidoEm: LocalTimestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 24 * 12),
            conferidoPor: 'Carlos Lima',
            conferidoEm: LocalTimestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 24 * 10),
            periodoInicial: LocalTimestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 24 * 25),
            periodoFinal: LocalTimestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 24 * 15)
          },
          {
            id: 'b2',
            pac: 'PAC 01 - Araucária',
            numEnsaios: 8,
            status: 'EM ANDAMENTO',
            recebidoPor: 'Carlos Lima',
            recebidoEm: LocalTimestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 24 * 5),
            periodoInicial: LocalTimestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 24 * 10),
            periodoFinal: LocalTimestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 24 * 5)
          },
          {
            id: 'b3',
            pac: 'PAC 03 - Curitiba',
            numEnsaios: 12,
            status: 'ABERTO',
            recebidoPor: 'Gabriel Ramos',
            recebidoEm: LocalTimestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 2),
            periodoInicial: LocalTimestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 24 * 2),
            periodoFinal: LocalTimestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 2)
          }
        ];
        localStorage.setItem('lotes_batches', JSON.stringify(initialBatches));
      }

      const savedNonConforConfigs = localStorage.getItem('lotes_non_conformities_configs');
      const savedNonConforRecords = localStorage.getItem('lotes_lote_nao_conformidades');

      let initialNonConforConfigs: ConfigItem[] = [];
      let initialNonConforRecords: any[] = [];

      if (savedNonConforConfigs) {
        initialNonConforConfigs = JSON.parse(savedNonConforConfigs);
      } else {
        initialNonConforConfigs = [
          { id: 'nc1', name: 'Placa não cadastrada' },
          { id: 'nc2', name: 'Documento ilegível' },
          { id: 'nc3', name: 'Divergência de veículo' },
          { id: 'nc4', name: 'Ensaio danificado' },
          { id: 'nc5', name: 'Lacre rompido' }
        ];
        localStorage.setItem('lotes_non_conformities_configs', JSON.stringify(initialNonConforConfigs));
      }

      if (savedNonConforRecords) {
        initialNonConforRecords = JSON.parse(savedNonConforRecords);
      } else {
        initialNonConforRecords = [];
        localStorage.setItem('lotes_lote_nao_conformidades', JSON.stringify(initialNonConforRecords));
      }

      // Load local framings (enquadramentos)
      const savedFramings = localStorage.getItem('lotes_framings');
      let initialFramings: any[] = [];
      if (savedFramings) {
        initialFramings = JSON.parse(savedFramings);
      } else {
        initialFramings = [
          { id: 'f1', number: 'Art. 12', description: 'Peso líquido abaixo do limite legal tolerado' },
          { id: 'f2', number: 'Art. 18 Sec. I', description: 'Falta de lacre de segurança' },
          { id: 'f3', number: 'Art. 22', description: 'Divergência grosseira no diâmetro nominal' }
        ];
        localStorage.setItem('lotes_framings', JSON.stringify(initialFramings));
      }

      // Load local notification types
      const savedNotificationTypes = localStorage.getItem('lotes_notification_types');
      let initialNotificationTypes: ConfigItem[] = [];
      const defaultAlertaType = { 
        id: 'nt0', 
        name: 'ALERTA 1 - ORIENTAÇÃO',
        rule: {
          active: true,
          validadeMeses: 12,
          criterioA_ativo: true,
          criterioA_ncId: '',
          criterioA_limite: 0,
          criterioB_ativo: false,
          criterioB_ncId: '',
          criterioB_limite: 0,
          operadorLogico: 'OU' as const,
          limiteNotificacoes: 1,
          proximoNivel_typeId: 'nt1',
          regraAtraso_ativa: true,
          regraAtraso_ncId: '',
          regraAtraso_limiteRepeticoes: 1
        }
      };

      if (savedNotificationTypes) {
        initialNotificationTypes = JSON.parse(savedNotificationTypes);
        // Ensure "ALERTA 1 - ORIENTAÇÃO" type exists as first option
        if (!initialNotificationTypes.some(t => t.id === 'nt0' || t.name === 'ALERTA 1 - ORIENTAÇÃO')) {
          initialNotificationTypes.unshift(defaultAlertaType);
          localStorage.setItem('lotes_notification_types', JSON.stringify(initialNotificationTypes));
        }
      } else {
        initialNotificationTypes = [
          defaultAlertaType,
          { 
            id: 'nt1', 
            name: 'Notificação de Irregularidade',
            rule: {
              active: true,
              validadeMeses: 12,
              criterioA_ativo: true,
              criterioA_ncId: '',
              criterioA_limite: 5,
              criterioB_ativo: true,
              criterioB_ncId: '',
              criterioB_limite: 10,
              operadorLogico: 'OU',
              limiteNotificacoes: 2,
              proximoNivel_typeId: 'nt2',
              regraAtraso_ativa: false,
              regraAtraso_ncId: '',
              regraAtraso_limiteRepeticoes: 2
            }
          },
          { 
            id: 'nt2', 
            name: 'Termo de Ocorrência',
            rule: {
              active: true,
              validadeMeses: 6,
              criterioA_ativo: true,
              criterioA_ncId: '',
              criterioA_limite: 10,
              criterioB_ativo: true,
              criterioB_ncId: '',
              criterioB_limite: 15,
              operadorLogico: 'E',
              limiteNotificacoes: 1,
              proximoNivel_typeId: 'nt3',
              regraAtraso_ativa: false,
              regraAtraso_ncId: '',
              regraAtraso_limiteRepeticoes: 2
            }
          },
          { 
            id: 'nt3', 
            name: 'Auto de Infração',
            rule: {
              active: true,
              validadeMeses: 6,
              criterioA_ativo: true,
              criterioA_ncId: '',
              criterioA_limite: 15,
              criterioB_ativo: false,
              criterioB_ncId: '',
              criterioB_limite: 20,
              operadorLogico: 'OU',
              limiteNotificacoes: 3,
              proximoNivel_typeId: '',
              regraAtraso_ativa: false,
              regraAtraso_ncId: '',
              regraAtraso_limiteRepeticoes: 2
            }
          }
        ];
        localStorage.setItem('lotes_notification_types', JSON.stringify(initialNotificationTypes));
      }

      // Load local generated notifications
      const savedGeneratedNotifications = localStorage.getItem('lotes_notifications');
      let initialGeneratedNotifications: any[] = [];
      if (savedGeneratedNotifications) {
        initialGeneratedNotifications = JSON.parse(savedGeneratedNotifications);
      } else {
        initialGeneratedNotifications = [];
        localStorage.setItem('lotes_notifications', JSON.stringify(initialGeneratedNotifications));
      }

      setPacs(initialPacs.sort((a, b) => a.name.localeCompare(b.name)));
      setCollaborators(initialCollabs.sort((a, b) => a.name.localeCompare(b.name)));
      setStatuses(initialStatuses.sort((a, b) => a.name.localeCompare(b.name)));
      setNonConformitiesConfigs(initialNonConforConfigs.sort((a, b) => a.name.localeCompare(b.name)));
      setFramings(initialFramings.sort((a, b) => a.number ? a.number.localeCompare(b.number) : 0));
      setNonConformityRecords(initialNonConforRecords);
      setNotificationTypes(initialNotificationTypes.sort((a, b) => a.name.localeCompare(b.name)));
      setGeneratedNotifications(initialGeneratedNotifications);
      setBatches(initialBatches);
      return;
    }

    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          setError("Erro de conexão com o Firebase. Verifique as regras de segurança.");
        }
      }
    };
    testConnection();

    const unsubBatches = onSnapshot(
      query(collection(db, 'batches'), orderBy('recebidoEm', 'desc')),
      (snapshot) => setBatches(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Batch))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'batches')
    );

    const unsubPacs = onSnapshot(
      query(collection(db, 'pacs'), orderBy('name')),
      (snapshot) => setPacs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ConfigItem))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'pacs')
    );

    const unsubCollabs = onSnapshot(
      query(collection(db, 'collaborators'), orderBy('name')),
      (snapshot) => setCollaborators(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ConfigItem))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'collaborators')
    );

    const unsubStatuses = onSnapshot(
      query(collection(db, 'statuses'), orderBy('name')),
      (snapshot) => setStatuses(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ConfigItem))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'statuses')
    );

    const unsubNonConforConfigs = onSnapshot(
      query(collection(db, 'non_conformities_configs'), orderBy('name')),
      (snapshot) => setNonConformitiesConfigs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ConfigItem))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'non_conformities_configs')
    );

    const unsubNonConforRecords = onSnapshot(
      collection(db, 'lote_nao_conformidades'),
      (snapshot) => setNonConformityRecords(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'lote_nao_conformidades')
    );

    const unsubNotificationTypes = onSnapshot(
      query(collection(db, 'notification_types'), orderBy('name')),
      (snapshot) => setNotificationTypes(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ConfigItem))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'notification_types')
    );

    const unsubFramings = onSnapshot(
      collection(db, 'framings'),
      (snapshot) => setFramings(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (a.number || '').localeCompare(b.number || ''))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'framings')
    );

    const unsubNotifications = onSnapshot(
      collection(db, 'notifications'),
      (snapshot) => setGeneratedNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    const unsubLogo = onSnapshot(
      doc(db, 'configs', 'branding'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data) {
            if (data.logoUrl !== undefined) {
              setLogoUrl(data.logoUrl);
              if (data.logoUrl) {
                localStorage.setItem('lotes_logoUrl', data.logoUrl);
              } else {
                localStorage.removeItem('lotes_logoUrl');
              }
            }
            if (data.signatures !== undefined) {
              setSignatures(data.signatures);
              localStorage.setItem('lotes_signatures', JSON.stringify(data.signatures));
            }
          }
        }
      },
      (err) => console.log('Firestore unsubLogo warn:', err)
    );

    return () => {
      unsubBatches();
      unsubPacs();
      unsubCollabs();
      unsubStatuses();
      unsubNonConforConfigs();
      unsubNonConforRecords();
      unsubNotificationTypes();
      unsubFramings();
      unsubNotifications();
      unsubLogo();
    };
  }, [user, isLocalMode]);

  // Autocorrect batches where recebidoPor is blank or "LUIZ", replacing with "LUIZ CARLOS"
  useEffect(() => {
    if (!user || batches.length === 0) return;
    
    const batchesNeedFix = batches.filter(b => {
      const rec = b.recebidoPor ? b.recebidoPor.trim().toUpperCase() : '';
      return rec === '' || rec === 'LUIZ';
    });
    
    if (batchesNeedFix.length === 0) return;
    
    const runFix = async () => {
      if (isLocalMode) {
        const updated = batches.map(b => {
          const rec = b.recebidoPor ? b.recebidoPor.trim().toUpperCase() : '';
          if (rec === '' || rec === 'LUIZ') {
            return { ...b, recebidoPor: 'LUIZ CARLOS' };
          }
          return b;
        });
        setBatches(updated);
        localStorage.setItem('lotes_batches', JSON.stringify(updated));
      } else {
        try {
          const batchUpdate = writeBatch(db);
          batchesNeedFix.forEach(b => {
            const docRef = doc(db, 'batches', b.id);
            batchUpdate.update(docRef, { recebidoPor: 'LUIZ CARLOS' });
          });
          await batchUpdate.commit();
        } catch (err) {
          console.error("Erro ao corrigir recebidoPor no Firestore:", err);
        }
      }
    };
    
    runFix();
  }, [user, batches, isLocalMode]);

  // Filtered Batches
  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      const matchesSearch = b.pac.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.recebidoPor.toLowerCase().includes(searchTerm.toLowerCase());
      
      const isFinished = !!b.conferidoPor && b.conferidoPor.trim() !== '';
      const deadline = addDays(b.periodoInicial.toDate(), 30);
      const daysRemaining = differenceInDays(deadline, new Date());
      const isOverdue = !isFinished && isAfter(new Date(), deadline);
      const isWarning = !isFinished && !isOverdue && daysRemaining <= 10;

      // Status Filter Logic
      if (statusFilter === 'open' && isFinished) return false;
      if (statusFilter === 'finished' && !isFinished) return false;
      if (statusFilter === 'ATRASO' && !isOverdue) return false;
      if (statusFilter === 'ALERTA' && !isWarning) return false;
      if (statusFilter === 'EM DIA' && (isOverdue || isWarning || isFinished)) return false;

      // Dashboard Period Filter
      const dateObj = isFinished 
        ? b.periodoInicial.toDate() 
        : (b.recebidoEm ? b.recebidoEm.toDate() : b.periodoInicial?.toDate());

      if (dateObj) {
        if (dashStartDate) {
          const start = startOfDay(parseLocalDate(dashStartDate));
          if (dateObj < start) return false;
        }
        if (dashEndDate) {
          const end = startOfDay(parseLocalDate(dashEndDate));
          if (startOfDay(dateObj) > end) return false;
        }
      }

      return matchesSearch;
    });
  }, [batches, searchTerm, statusFilter, dashStartDate, dashEndDate]);

  // Statistics for Dashboard overview cards (respects the selected Dashboard period filter)
  const stats = useMemo(() => {
    let onTimeCount = 0;
    let lateCount = 0;
    let totalEnsaiosFinished = 0;
    let totalEnsaiosOpen = 0;
    let totalEnsaiosReceived = 0;

    batches.forEach(b => {
      const hasInformado = b.conferidoPor && b.conferidoPor.trim() !== '';

      if (hasInformado) {
        // Check if finished batch is within dashboard period filter (using periodoInicial)
        let match = true;
        if (dashStartDate) {
          const start = startOfDay(parseLocalDate(dashStartDate));
          if (b.periodoInicial.toDate() < start) match = false;
        }
        if (dashEndDate) {
          const end = startOfDay(parseLocalDate(dashEndDate));
          if (startOfDay(b.periodoInicial.toDate()) > end) match = false;
        }

        if (match) {
          totalEnsaiosFinished += b.numEnsaios;
          
          // On time vs Late
          const deadline = addDays(b.periodoInicial.toDate(), 30);
          if (isAfter(b.conferidoEm!.toDate(), deadline)) {
            lateCount++;
          } else {
            onTimeCount++;
          }
        }
      } else {
        // Check if open batch is within dashboard period filter (using recebidoEm)
        let matchOpen = true;
        const openDate = b.recebidoEm ? b.recebidoEm.toDate() : b.periodoInicial?.toDate();
        if (openDate) {
          if (dashStartDate) {
            const start = startOfDay(parseLocalDate(dashStartDate));
            if (openDate < start) matchOpen = false;
          }
          if (dashEndDate) {
            const end = startOfDay(parseLocalDate(dashEndDate));
            if (startOfDay(openDate) > end) matchOpen = false;
          }
        } else {
          matchOpen = false;
        }

        if (matchOpen) {
          totalEnsaiosOpen += b.numEnsaios;
        }
      }

      // Check if batch is within dashboard period filter using recebidoEm and has recebidoPor filled
      let matchReceived = true;
      if (dashStartDate) {
        const start = startOfDay(parseLocalDate(dashStartDate));
        if (b.recebidoEm.toDate() < start) matchReceived = false;
      }
      if (dashEndDate) {
        const end = startOfDay(parseLocalDate(dashEndDate));
        if (startOfDay(b.recebidoEm.toDate()) > end) matchReceived = false;
      }

      if (matchReceived && b.recebidoPor && b.recebidoPor.trim() !== '') {
        totalEnsaiosReceived += b.numEnsaios;
      }
    });

    const totalFinished = onTimeCount + lateCount;

    return {
      onTimeCount,
      lateCount,
      totalFinished,
      totalEnsaiosFinished,
      totalEnsaiosOpen,
      totalEnsaiosReceived
    };
  }, [batches, dashStartDate, dashEndDate]);

  const handleDeleteBatch = async (id: string) => {
    if (isLocalMode) {
      const updated = batches.filter(b => b.id !== id);
      setBatches(updated);
      localStorage.setItem('lotes_batches', JSON.stringify(updated));
      setBatchToDelete(null);
      return;
    }
    try {
      await deleteDoc(doc(db, 'batches', id));
      setBatchToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `batches/${id}`);
    }
  };

  const handleUpdateConfig = async (type: string, id: string, name: string, extraFields?: any) => {
    if (isLocalMode) {
      if (type === 'pacs') {
        const updated = pacs.map(p => p.id === id ? { ...p, name } : p).sort((a, b) => a.name.localeCompare(b.name));
        setPacs(updated);
        localStorage.setItem('lotes_pacs', JSON.stringify(updated));
      } else if (type === 'collaborators') {
        const updated = collaborators.map(c => c.id === id ? { ...c, name } : c).sort((a, b) => a.name.localeCompare(b.name));
        setCollaborators(updated);
        localStorage.setItem('lotes_collaborators', JSON.stringify(updated));
      } else if (type === 'statuses') {
        const updated = statuses.map(s => s.id === id ? { ...s, name } : s).sort((a, b) => a.name.localeCompare(b.name));
        setStatuses(updated);
        localStorage.setItem('lotes_statuses', JSON.stringify(updated));
      } else if (type === 'non_conformities_configs') {
        const updated = nonConformitiesConfigs.map(s => s.id === id ? { ...s, name, ...(extraFields || {}) } : s).sort((a, b) => a.name.localeCompare(b.name));
        setNonConformitiesConfigs(updated);
        localStorage.setItem('lotes_non_conformities_configs', JSON.stringify(updated));
      } else if (type === 'notification_types') {
        const updated = notificationTypes.map(s => s.id === id ? { ...s, name } : s).sort((a, b) => a.name.localeCompare(b.name));
        setNotificationTypes(updated);
        localStorage.setItem('lotes_notification_types', JSON.stringify(updated));
      }
      return;
    }
    try {
      await updateDoc(doc(db, type, id), { name, ...(extraFields || {}) });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${type}/${id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5A5A40]"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] p-4">
        <div className="max-w-md w-full bg-white rounded-[32px] p-8 sm:p-12 shadow-xl text-center">
          <h1 className="text-4xl font-display font-bold tracking-tight mb-4 text-[#1a1a1a]">Gestão de Lotes</h1>
          <p className="text-[#5A5A40] mb-8 leading-relaxed">
            Gerencie e acompanhe lotes de ensaios de modo rápido, prático e persistente.
          </p>

          {googleLoginError && (() => {
            const parsed = parseAuthError(googleLoginError);
            return (
              <div className="mb-6 bg-red-50 border border-red-200 text-left p-5 rounded-2.5xl relative">
                <button 
                  onClick={() => setGoogleLoginError(null)} 
                  className="absolute top-4 right-4 text-[#5a5a40] hover:text-red-700 transition cursor-pointer"
                  title="Fechar"
                >
                  <X size={16} />
                </button>
                <div className="flex gap-2.5 items-start text-red-800">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm leading-snug">{parsed.title}</h3>
                    <p className="text-xs mt-1 text-red-700/90 leading-normal">{parsed.message}</p>
                  </div>
                </div>
                {parsed.actionHtml && (
                  <div dangerouslySetInnerHTML={{ __html: parsed.actionHtml }} />
                )}
              </div>
            );
          })()}

          <button 
            onClick={handleLogin}
            className="w-full bg-[#5A5A40] text-white rounded-full py-4 font-semibold hover:bg-[#4a4a30] transition-colors flex items-center justify-center gap-3 shadow-md mb-4 cursor-pointer"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5 bg-white rounded-full p-0.5" alt="Google" />
            Entrar com Google
          </button>

          <div className="relative flex py-4 items-center">
            <div className="flex-grow border-t border-[#e5e5e0]"></div>
            <span className="flex-shrink mx-4 text-[10px] text-[#5A5A40] opacity-50 uppercase font-bold tracking-wider">Ou</span>
            <div className="flex-grow border-t border-[#e5e5e0]"></div>
          </div>

          <button 
            onClick={handleLocalLogin}
            className="w-full bg-white border border-[#5A5A40]/35 text-[#5A5A40] rounded-full py-4 font-semibold hover:bg-[#f0f0e5] transition-colors flex items-center justify-center gap-3 cursor-pointer shadow-sm"
          >
            Entrar em Modo Local (Demonstração)
          </button>

          <p className="text-[11px] text-[#5A5A40]/60 mt-6 leading-relaxed bg-[#f5f5f0] p-4 rounded-2xl border border-[#e5e5e0]">
            💡 Se você estiver visualizando dentro do editor do AI Studio e os popups forem bloqueados pelo navegador, use o <strong>Modo Local</strong>. Os dados serão salvos de forma segura no seu navegador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f0] text-[#1a1a1a] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-[#e5e5e0] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-display font-bold tracking-tight">Lotes Ensaio</h1>
            <nav className="flex gap-1">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all",
                  activeTab === 'dashboard' ? "bg-[#5A5A40] text-white" : "text-[#5A5A40] hover:bg-[#f0f0e5]"
                )}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setActiveTab('stats')}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all",
                  activeTab === 'stats' ? "bg-[#5A5A40] text-white" : "text-[#5A5A40] hover:bg-[#f0f0e5]"
                )}
              >
                Estatísticas
              </button>
              <button 
                onClick={() => setActiveTab('notifications')}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all",
                  activeTab === 'notifications' ? "bg-[#5A5A40] text-white" : "text-[#5A5A40] hover:bg-[#f0f0e5]"
                )}
              >
                Notificações
              </button>
              <button 
                onClick={() => setActiveTab('config')}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all",
                  activeTab === 'config' ? "bg-[#5A5A40] text-white" : "text-[#5A5A40] hover:bg-[#f0f0e5]"
                )}
              >
                Configurações
              </button>
              <button 
                onClick={() => setActiveTab('tutorial')}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5",
                  activeTab === 'tutorial' ? "bg-[#5A5A40] text-white" : "text-[#5A5A40] hover:bg-[#f0f0e5]"
                )}
              >
                <BookOpen size={14} className="mt-0.5" /> Tutorial do Sistema
              </button>
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user.displayName}</p>
              <p className="text-xs text-[#5A5A40]">{user.email}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-[#5A5A40] hover:bg-[#f0f0e5] rounded-full transition-colors"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {error && (() => {
          const isQuota = error.toLowerCase().includes('quota') || error.toLowerCase().includes('exceeded') || error.toLowerCase().includes('cota') || error.toLowerCase().includes('limite') || error.toLowerCase().includes('permission');
          return (
            <div className={cn(
              "mb-6 rounded-[24px] p-6 shadow-md border",
              isQuota ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-red-50 border-red-200 text-red-900"
            )}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <AlertCircle size={22} className={cn("shrink-0 mt-0.5", isQuota ? "text-amber-600" : "text-red-600")} />
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold uppercase tracking-wider">
                      {isQuota ? "Uso da Cota Diária do Banco de Dados Cloud Excedida" : "Erro de Conexão / Operação no Servidor"}
                    </h3>
                    <p className="text-xs leading-relaxed max-w-4xl">
                      {isQuota ? (
                        <>
                          O servidor do banco de dados na nuvem (Firestore) atingiu os limites diários do plano gratuito para este projeto. 
                          Para que você não perca seu progresso e continue utilizando todas as funcionalidades normalmente, você pode reativar o <strong>Modo de Armazenamento Local</strong> de backup imediato. Seus dados serão mantidos de forma segura no seu navegador.
                        </>
                      ) : (
                        <>
                          Ocorreu um problema ao conectar ou sincronizar as informações com a nuvem. Você pode continuar trabalhando de forma offline e segura mudando para o Modo de Armazenamento Local.
                        </>
                      )}
                    </p>
                    <p className={cn("text-[10px] leading-normal mt-1 border-t pt-1 font-mono", isQuota ? "text-amber-700/75 border-amber-200/50" : "text-red-700/75 border-red-200/50")}>
                      Detalhes técnicos: {error}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 self-end md:self-center shrink-0">
                  <button
                    onClick={enableLocalMode}
                    className={cn(
                      "px-4 py-2 text-white font-bold text-xs rounded-full transition-colors shadow-md flex items-center gap-1.5 cursor-pointer",
                      isQuota ? "bg-amber-600 hover:bg-amber-700" : "bg-red-600 hover:bg-red-700"
                    )}
                  >
                    <Sparkles size={13} className="animate-pulse" /> Ativar Modo Local Inteligente
                  </button>
                  <button 
                    onClick={() => setError(null)} 
                    className="p-2 hover:bg-black/5 rounded-full transition-colors"
                    title="Ignorar"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {activeTab === 'dashboard' ? (
          <>
            {/* Filtro de Período do Dashboard */}
            <div className="bg-white p-6 rounded-[24px] border border-[#e5e5e0] mb-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#5A5A40]">Filtro de Período de Produção</h3>
                  <p className="text-xs text-[#5A5A40]/60">Mostrando dados correspondentes aos lotes cujo período inicial está no intervalo selecionado.</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#5A5A40]/70">De:</span>
                    <input
                      type="date"
                      className="px-3 py-2 bg-[#f5f5f0] border border-[#e5e5e0] rounded-xl text-xs focus:ring-2 focus:ring-[#5A5A40]/20 focus:outline-none font-medium text-gray-700"
                      value={dashStartDate}
                      onChange={(e) => setDashStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#5A5A40]/70">Até:</span>
                    <input
                      type="date"
                      className="px-3 py-2 bg-[#f5f5f0] border border-[#e5e5e0] rounded-xl text-xs focus:ring-2 focus:ring-[#5A5A40]/20 focus:outline-none font-medium text-gray-700"
                      value={dashEndDate}
                      onChange={(e) => setDashEndDate(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setDashStartDate(defaultDashStart);
                        setDashEndDate(defaultDashEnd);
                      }}
                      className="px-3 py-2 bg-[#f0f0e5] font-bold text-[#5A5A40] text-xs rounded-xl hover:bg-[#e0e0d5] transition-all"
                      title="Reiniciar para o mês atual"
                    >
                      Este Mês
                    </button>
                    <button
                      onClick={() => {
                        setDashStartDate('');
                        setDashEndDate('');
                      }}
                      className="px-3 py-2 bg-gray-100 font-bold text-gray-600 text-xs rounded-xl hover:bg-gray-200 transition-all"
                      title="Mostrar todos os registros"
                    >
                      Limpar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-[24px] border border-[#e5e5e0] flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                  <Download size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-[#5A5A40] opacity-60">Total Recebido</p>
                  <p className="text-2xl font-bold">{stats.totalEnsaiosReceived}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[24px] border border-[#e5e5e0] flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-[#5A5A40] opacity-60">Total em Aberto</p>
                  <p className="text-2xl font-bold">{stats.totalEnsaiosOpen}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[24px] border border-[#e5e5e0] flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-[#5A5A40] opacity-60">Finalizados</p>
                  <p className="text-2xl font-bold">{stats.totalEnsaiosFinished}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[24px] border border-[#e5e5e0] flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-[#5A5A40] opacity-60">No Prazo</p>
                  <p className="text-2xl font-bold">
                    {stats.totalFinished > 0 ? Math.round((stats.onTimeCount / stats.totalFinished) * 100) : 0}%
                  </p>
                </div>
              </div>
            </div>

            {/* Dashboard Header */}
            <div className="flex flex-col md:flex-row gap-4 mb-8 items-center justify-between">
              <div className="flex flex-1 flex-col md:flex-row gap-4 w-full">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5A40]" size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar por PAC, Status ou Colaborador..."
                    className="w-full pl-12 pr-4 py-3 bg-white border border-[#e5e5e0] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="relative w-full md:w-48">
                  <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5A40]" size={18} />
                  <select 
                    className="w-full pl-12 pr-4 py-3 bg-white border border-[#e5e5e0] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 appearance-none"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="open">Em Aberto</option>
                    <option value="finished">Finalizados</option>
                    <option value="all">Todos os Lotes</option>
                    <option value="EM DIA">Em Dia (Aberto)</option>
                    <option value="ALERTA">Alerta (Aberto)</option>
                    <option value="ATRASO">Atrasado (Aberto)</option>
                  </select>
                </div>
              </div>
              <button 
                onClick={() => {
                  setEditingBatch(null);
                  setIsModalOpen(true);
                }}
                className="w-full md:w-auto bg-[#5A5A40] text-white px-6 py-3 rounded-2xl font-medium hover:bg-[#4a4a30] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#5A5A40]/10 shrink-0"
              >
                <Plus size={20} />
                Receber Novo Lote
              </button>
            </div>

            {/* Batches Grid */}
            <div className="grid grid-cols-1 gap-4">
              {filteredBatches.map((batch) => (
                <BatchCard 
                  key={batch.id} 
                  batch={batch} 
                  onEdit={() => {
                    setEditingBatch(batch);
                    setIsModalOpen(true);
                  }}
                  onDelete={() => setBatchToDelete(batch.id)}
                />
              ))}
              {filteredBatches.length === 0 && (
                <div className="text-center py-20 bg-white rounded-[32px] border border-dashed border-[#e5e5e0]">
                  <Clock className="mx-auto mb-4 text-[#5A5A40]/30" size={48} />
                  <p className="text-[#5A5A40]">Nenhum lote encontrado.</p>
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'stats' ? (
          <StatsPanel batches={batches} collaborators={collaborators} pacs={pacs} />
        ) : activeTab === 'notifications' ? (
          <NotificationsPanel 
            batches={batches}
            pacs={pacs}
            nonConformityRecords={nonConformityRecords}
            nonConformitiesConfigs={nonConformitiesConfigs}
            notificationTypes={notificationTypes}
            generatedNotifications={generatedNotifications}
            setGeneratedNotifications={setGeneratedNotifications}
            isLocalMode={isLocalMode}
            handleFirestoreError={handleFirestoreError}
            logoUrl={logoUrl}
            signatures={signatures}
          />
        ) : activeTab === 'config' ? (
          <ConfigPanel 
            pacs={pacs} 
            collaborators={collaborators} 
            statuses={statuses}
            nonConformitiesConfigs={nonConformitiesConfigs}
            nonConformityRecords={nonConformityRecords}
            notificationTypes={notificationTypes}
            framings={framings}
            setFramings={setFramings}
            handleFirestoreError={handleFirestoreError}
            onUpdate={handleUpdateConfig}
            setConfigToDelete={setConfigToDelete}
            isLocalMode={isLocalMode}
            batches={batches}
            setBatches={setBatches}
            setPacs={setPacs}
            setCollaborators={setCollaborators}
            setStatuses={setStatuses}
            setNonConformitiesConfigs={setNonConformitiesConfigs}
            setNotificationTypes={setNotificationTypes}
            logoUrl={logoUrl}
            saveLogoUrl={saveLogoUrl}
            signatures={signatures}
            saveSignatures={saveSignatures}
          />
        ) : (
          <SystemTutorial />
        )}
      </main>

      {/* Modals */}
        {isModalOpen && (
          <BatchModal 
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            batch={editingBatch}
            pacs={pacs}
            collaborators={collaborators}
            statuses={statuses}
            nonConformitiesConfigs={nonConformitiesConfigs}
            handleFirestoreError={handleFirestoreError}
            isLocalMode={isLocalMode}
            onSaveLocalBatch={(localBatch: any, batchNCs: any[]) => {
              let updated;
              let batchId = '';
              if (editingBatch) {
                batchId = editingBatch.id;
                updated = batches.map(b => b.id === editingBatch.id ? { ...b, ...localBatch, nonConformities: batchNCs } : b);
              } else {
                batchId = 'local-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
                updated = [{ ...localBatch, id: batchId, nonConformities: batchNCs }, ...batches];
              }
              updated.sort((a, b) => b.recebidoEm.toDate().getTime() - a.recebidoEm.toDate().getTime());
              setBatches(updated);
              localStorage.setItem('lotes_batches', JSON.stringify(updated));

              // Save lote_nao_conformidades in local storage
              const savedNCRecords = localStorage.getItem('lotes_lote_nao_conformidades');
              let ncRecords = savedNCRecords ? JSON.parse(savedNCRecords) : [];
              // Filter out old ones for this batch ID
              ncRecords = ncRecords.filter((nc: any) => nc.recebimento_lote_id !== batchId);
              // Map and add new ones
              const newNCObjects = batchNCs.map(item => ({
                id: item.id.startsWith('nc-') ? item.id : 'ncLocal-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
                recebimento_lote_id: batchId,
                nao_conformidade_id: item.nao_conformidade_id,
                pac_id: localBatch.pac,
                placas: item.placas
              }));
              const updatedNCs = [...ncRecords, ...newNCObjects];
              localStorage.setItem('lotes_lote_nao_conformidades', JSON.stringify(updatedNCs));
              setNonConformityRecords(updatedNCs);
            }}
          />
        )}

        {batchToDelete && (
          <ConfirmModal 
            title="Excluir Lote"
            message="Tem certeza que deseja excluir este lote? Esta ação não pode ser desfeita."
            onConfirm={() => handleDeleteBatch(batchToDelete)}
            onCancel={() => setBatchToDelete(null)}
          />
        )}

        {configToDelete && (
          <ConfirmModal 
            title="Excluir Item"
            message="Tem certeza que deseja excluir este item das configurações?"
            onConfirm={async () => {
              const { type, id } = configToDelete;
              if (isLocalMode) {
                if (type === 'pacs') {
                  const updated = pacs.filter(p => p.id !== id);
                  setPacs(updated);
                  localStorage.setItem('lotes_pacs', JSON.stringify(updated));
                } else if (type === 'collaborators') {
                  const updated = collaborators.filter(c => c.id !== id);
                  setCollaborators(updated);
                  localStorage.setItem('lotes_collaborators', JSON.stringify(updated));
                } else if (type === 'statuses') {
                  const updated = statuses.filter(s => s.id !== id);
                  setStatuses(updated);
                  localStorage.setItem('lotes_statuses', JSON.stringify(updated));
                } else if (type === 'non_conformities_configs') {
                  const updated = nonConformitiesConfigs.filter(s => s.id !== id);
                  setNonConformitiesConfigs(updated);
                  localStorage.setItem('lotes_non_conformities_configs', JSON.stringify(updated));
                } else if (type === 'notification_types') {
                  const updated = notificationTypes.filter(s => s.id !== id);
                  setNotificationTypes(updated);
                  localStorage.setItem('lotes_notification_types', JSON.stringify(updated));
                }
                setConfigToDelete(null);
                return;
              }
              try {
                await deleteDoc(doc(db, type, id));
                setConfigToDelete(null);
              } catch (err) {
                handleFirestoreError(err, OperationType.DELETE, `${type}/${id}`);
              }
            }}
            onCancel={() => setConfigToDelete(null)}
          />
        )}
      </div>
    );
}

function ConfirmModal({ title, message, onConfirm, onCancel }: any) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8 animate-in fade-in zoom-in duration-200">
        <h3 className="text-xl font-display font-bold tracking-tight mb-4">{title}</h3>
        <p className="text-[#5A5A40] mb-8">{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 px-6 py-3 rounded-2xl font-medium border border-[#e5e5e0] hover:bg-[#f5f5f0] transition-all"
          >
            Cancelar
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 px-6 py-3 bg-red-500 text-white rounded-2xl font-medium hover:bg-red-600 transition-all"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

function BatchCard({ batch, onEdit, onDelete }: any) {
  const formatDate = (ts?: Timestamp) => ts ? format(ts.toDate(), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-';
  const formatPeriod = (ts: Timestamp) => format(ts.toDate(), "dd/MM/yyyy", { locale: ptBR });

  // Deadline Logic
  const isFinished = !!batch.conferidoPor && batch.conferidoPor.trim() !== '';
  const deadline = addDays(batch.periodoInicial.toDate(), 30);
  const daysRemaining = differenceInDays(deadline, new Date());
  const isOverdue = !isFinished && isAfter(new Date(), deadline);
  const isWarning = !isFinished && !isOverdue && daysRemaining <= 10;

  const dynamicStatus = isFinished ? 'FINALIZADO' : isOverdue ? 'EM ATRASO' : isWarning ? 'ALERTA' : batch.status;

  return (
    <div className={cn(
      "bg-white rounded-[24px] p-6 border transition-all group",
      isOverdue ? "border-red-200 bg-red-50/10" : 
      batch.ensaioForaDoPrazo ? "border-amber-300 bg-amber-50/20 shadow-md shadow-amber-500/5 md:border-l-[6px] md:border-l-amber-500" : 
      isWarning ? "border-amber-200 bg-amber-50/10" : "border-[#e5e5e0]"
    )}>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Info */}
        <div className="flex-1">
          <div className="flex items-start justify-between mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#5A5A40] opacity-60">PAC</span>
                <h3 className="text-xl font-display font-bold tracking-tight">{batch.pac}</h3>
              </div>
              {batch.ensaioForaDoPrazo && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg">
                  <AlertTriangle size={12} className="text-amber-600 animate-pulse" /> ENTREGA IRREGULAR
                </span>
              )}
              {isOverdue && (
                <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-lg">
                  <AlertCircle size={12} /> ATRASADO
                </span>
              )}
              {isWarning && (
                <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-lg">
                  <Clock size={12} /> ALERTA
                </span>
              )}
            </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full border",
                  isOverdue ? "bg-red-100 text-red-700 border-red-200" : 
                  isWarning ? "bg-amber-100 text-amber-700 border-amber-200" : 
                  "bg-[#f0f0e5] text-[#5A5A40] border-[#e5e5e0]"
                )}>
                  {dynamicStatus}
                </span>
                <button onClick={onEdit} className="p-2 hover:bg-[#f0f0e5] rounded-full text-[#5A5A40] transition-colors">
                  <Edit3 size={18} />
                </button>
                <button onClick={onDelete} className="p-2 hover:bg-red-50 rounded-full text-red-500 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] uppercase font-bold text-[#5A5A40] opacity-50 mb-1">Período</p>
              <p className="text-sm font-medium">{formatPeriod(batch.periodoInicial)} - {formatPeriod(batch.periodoFinal)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-[#5A5A40] opacity-50 mb-1">Nº Ensaios</p>
              <p className="text-sm font-medium">{batch.numEnsaios}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-[#5A5A40] opacity-50 mb-1">Recebido por</p>
              <p className="text-sm font-medium">{batch.recebidoPor}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-[#5A5A40] opacity-50 mb-1">Recebido em</p>
              <p className="text-sm font-medium">{formatDate(batch.recebidoEm)}</p>
            </div>
          </div>
        </div>

        {/* Workflow Steps */}
        <div className="lg:w-80 flex flex-col gap-2 border-t lg:border-t-0 lg:border-l border-[#e5e5e0] pt-4 lg:pt-0 lg:pl-6">
          <WorkflowStep label="Lido" user={batch.lidoPor} date={batch.lidoEm} />
          <WorkflowStep label="Informado" user={batch.conferidoPor} date={batch.conferidoEm} />
        </div>
      </div>
    </div>
  );
}

function WorkflowStep({ label, user, date }: { label: string, user?: string, date?: Timestamp }) {
  const isDone = !!user;
  return (
    <div className={cn(
      "flex items-center gap-3 p-2 rounded-xl transition-colors",
      isDone ? "bg-emerald-50/50" : "bg-[#f5f5f0]/50"
    )}>
      <div className={cn(
        "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
        isDone ? "bg-emerald-500 text-white" : "bg-[#e5e5e0] text-[#5A5A40]"
      )}>
        {isDone ? <Check size={14} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-tight opacity-60">{label}</p>
        <p className="text-xs font-medium truncate">
          {isDone ? `${user} • ${format(date!.toDate(), "dd/MM/yy")}` : 'Pendente'}
        </p>
      </div>
    </div>
  );
}

function SearchableSelect({ label, value, options, onChange, placeholder, required }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    return options.filter((opt: any) => 
      opt.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt: any) => opt.name === value);

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      <label className="text-xs font-bold uppercase text-[#5A5A40]">{label}</label>
      <div 
        className="relative cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl focus-within:ring-2 focus-within:ring-[#5A5A40]/20 flex items-center justify-between">
          <span className={cn("text-sm", !value && "text-[#5A5A40]/50")}>
            {value || placeholder}
          </span>
          <ChevronDown size={18} className={cn("text-[#5A5A40]/50 transition-transform", isOpen && "rotate-180")} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-[#e5e5e0] rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 border-b border-[#e5e5e0] sticky top-0 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A40]/40" size={14} />
              <input 
                type="text"
                autoFocus
                className="w-full pl-9 pr-3 py-2 bg-[#f5f5f0] border-none rounded-lg text-sm focus:outline-none"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt: any) => (
                <div 
                  key={opt.id}
                  className={cn(
                    "px-4 py-2 text-sm hover:bg-[#f5f5f0] cursor-pointer transition-colors",
                    value === opt.name && "bg-[#5A5A40]/5 font-bold text-[#5A5A40]"
                  )}
                  onClick={() => {
                    onChange(opt.name);
                    setIsOpen(false);
                    setSearch('');
                  }}
                >
                  {opt.name}
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-[#5A5A40]/50 italic">
                Nenhum resultado encontrado
              </div>
            )}
          </div>
        </div>
      )}
      <input type="hidden" required={required} value={value} />
    </div>
  );
}

function BatchModal({ isOpen, onClose, batch, pacs, collaborators, statuses, nonConformitiesConfigs, handleFirestoreError, isLocalMode, onSaveLocalBatch }: any) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    pac: batch?.pac || '',
    periodoInicial: batch?.periodoInicial ? format(batch.periodoInicial.toDate(), "yyyy-MM-dd") : '',
    periodoFinal: batch?.periodoFinal ? format(batch.periodoFinal.toDate(), "yyyy-MM-dd") : '',
    numEnsaios: batch?.numEnsaios || 0,
    status: batch?.status || 'ABERTO', // Default to ABERTO
    recebidoPor: batch?.recebidoPor || '',
    lidoPor: batch?.lidoPor || '',
    conferidoPor: batch?.conferidoPor || '',
    ensaioForaDoPrazo: batch?.ensaioForaDoPrazo || false,
  });

  // Non-conformity specific states within BatchModal
  const [activeSubView, setActiveSubView] = useState<'main' | 'addNonConformity'>('main');
  const [localNonConformities, setLocalNonConformities] = useState<any[]>([]);
  const [nonConformityItems, setNonConformityItems] = useState<{ plate: string; reasonId: string }[]>([
    { plate: '', reasonId: '' }
  ]);
  const [subError, setSubError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (isLocalMode) {
      setLocalNonConformities(batch?.nonConformities || []);
    } else if (batch) {
      const fetchNCs = async () => {
        try {
          const q = query(
            collection(db, 'lote_nao_conformidades'), 
            where('recebimento_lote_id', '==', batch.id)
          );
          const snapshot = await getDocs(q);
          const list = snapshot.docs.map(docRef => {
            const data = docRef.data();
            const reason = nonConformitiesConfigs?.find((c: any) => c.id === data.nao_conformidade_id);
            return {
              id: docRef.id,
              nao_conformidade_id: data.nao_conformidade_id,
              nao_conformidade_name: reason ? reason.name : (data.nao_conformidade_name || 'Outro'),
              placas: data.placas || []
            };
          });
          setLocalNonConformities(list);
        } catch (err) {
          console.error("Error loading non-conformities", err);
        }
      };
      fetchNCs();
    } else {
      setLocalNonConformities([]);
    }
  }, [batch, isOpen, isLocalMode, nonConformitiesConfigs]);

  const handleIncludeClick = () => {
    if (!formData.pac) {
      setLocalError("Por favor, selecione um PAC antes de registrar uma não-conformidade.");
      return;
    }
    setNonConformityItems([{ plate: '', reasonId: '' }]);
    setSubError(null);
    setActiveSubView('addNonConformity');
  };

  const handleAddNonConformityItem = () => {
    setNonConformityItems([...nonConformityItems, { plate: '', reasonId: '' }]);
  };

  const handleNonConformityItemChange = (index: number, field: 'plate' | 'reasonId', val: string) => {
    const updated = [...nonConformityItems];
    updated[index] = {
      ...updated[index],
      [field]: field === 'plate' ? val.toUpperCase() : val
    };
    setNonConformityItems(updated);
  };

  const handleRemoveNonConformityItem = (index: number) => {
    setNonConformityItems(nonConformityItems.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Auto-status logic: if "Informado" field is filled, status becomes FINALIZADO automatically. If not, fallback to default status
    const hasInformado = formData.conferidoPor && formData.conferidoPor.trim() !== '';
    let finalStatus = formData.status;
    if (hasInformado) {
      finalStatus = 'FINALIZADO';
    } else {
      if (finalStatus === 'FINALIZADO') {
        finalStatus = 'ABERTO';
      }
    }

    try {
      const getTimestampFromDate = (date: Date) => {
        return isLocalMode ? LocalTimestamp.fromDate(date) : Timestamp.fromDate(date);
      };
      
      const getTimestampNow = () => {
        return isLocalMode ? LocalTimestamp.now() : Timestamp.now();
      };

      const data = {
        ...formData,
        status: finalStatus,
        numEnsaios: Number(formData.numEnsaios),
        periodoInicial: getTimestampFromDate(parseLocalDate(formData.periodoInicial)),
        periodoFinal: getTimestampFromDate(parseLocalDate(formData.periodoFinal)),
        recebidoEm: batch?.recebidoEm || getTimestampNow(),
        lidoEm: formData.lidoPor.trim() ? (batch?.lidoPor ? batch.lidoEm : getTimestampNow()) : null,
        conferidoEm: formData.conferidoPor.trim() ? (batch?.conferidoPor ? batch.conferidoEm : getTimestampNow()) : null,
      };

      if (isLocalMode) {
        onSaveLocalBatch(data, localNonConformities);
        onClose();
        return;
      }

      let batchId = '';
      if (batch) {
        batchId = batch.id;
        await updateDoc(doc(db, 'batches', batch.id), {
          ...data,
          nonConformities: localNonConformities
        });
      } else {
        const docRef = await addDoc(collection(db, 'batches'), {
          ...data,
          nonConformities: localNonConformities
        });
        batchId = docRef.id;
      }

      // Sync nonconformities in Firestore
      const q = query(
        collection(db, 'lote_nao_conformidades'), 
        where('recebimento_lote_id', '==', batchId)
      );
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(docRef => deleteDoc(docRef.ref));
      await Promise.all(deletePromises);

      const addPromises = localNonConformities.map(item => {
        return addDoc(collection(db, 'lote_nao_conformidades'), {
          recebimento_lote_id: batchId,
          nao_conformidade_id: item.nao_conformidade_id,
          pac_id: data.pac,
          placas: item.placas
        });
      });
      await Promise.all(addPromises);

      onClose();
    } catch (err) {
      handleFirestoreError(err, batch ? OperationType.UPDATE : OperationType.CREATE, 'batches');
    }
  };

  if (activeSubView === 'addNonConformity') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
          <div className="p-8 border-b border-[#e5e5e0] flex items-center justify-between col-span-full">
            <h2 className="text-2xl font-display font-bold tracking-tight text-[#5A5A40]">Cadastrar Não-Conformidade</h2>
            <button 
              type="button"
              onClick={() => setActiveSubView('main')} 
              className="p-2 hover:bg-[#f5f5f0] rounded-full"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
            {subError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle size={18} />
                  <p className="text-sm">{subError}</p>
                </div>
                <button type="button" onClick={() => setSubError(null)}><X size={18} /></button>
              </div>
            )}

            <div className="space-y-4">
              <label className="text-xs font-bold uppercase text-[#5A5A40]">Placas e Seus Motivos Relacionados</label>
              
              <div className="space-y-4">
                {nonConformityItems.map((item, index) => (
                  <div key={index} className="flex flex-col sm:flex-row gap-3 p-4 bg-[#f5f5f0]/50 rounded-2xl border border-[#e5e5e0] relative">
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-bold uppercase text-[#5A5A40]/70">Placa Afetada</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: ABC1234"
                        className="w-full p-3 bg-white border border-[#e5e5e0] rounded-xl focus:ring-2 focus:ring-[#5A5A40]/20 font-mono text-sm uppercase"
                        value={item.plate}
                        onChange={e => handleNonConformityItemChange(index, 'plate', e.target.value)}
                        style={{ textTransform: 'uppercase' }}
                      />
                    </div>
                    
                    <div className="flex-[2] space-y-1">
                      <label className="text-[10px] font-bold uppercase text-[#5A5A40]/70">Motivo de Não-Conformidade</label>
                      <select
                        required
                        className="w-full p-3 bg-white border border-[#e5e5e0] rounded-xl focus:ring-2 focus:ring-[#5A5A40]/20 text-sm"
                        value={item.reasonId}
                        onChange={e => handleNonConformityItemChange(index, 'reasonId', e.target.value)}
                      >
                        <option value="">Selecionar não-conformidade</option>
                        {nonConformitiesConfigs.map((nc: any) => (
                          <option key={nc.id} value={nc.id}>
                            {nc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {nonConformityItems.length > 1 && (
                      <div className="flex items-end justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveNonConformityItem(index)}
                          className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors self-end"
                          title="Remover placa e motivo"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <button
                type="button"
                onClick={handleAddNonConformityItem}
                className="text-[#5A5A40] text-sm font-bold flex items-center gap-1 hover:underline mt-2"
              >
                <Plus size={16} />
                Adicionar Outra Placa / Motivo
              </button>
            </div>

            <div className="pt-6 flex gap-3 border-t border-[#e5e5e0]">
              <button
                type="button"
                onClick={() => setActiveSubView('main')}
                className="flex-1 px-6 py-3 rounded-2xl font-medium border border-[#e5e5e0] hover:bg-[#f5f5f0] transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const incompleteRow = nonConformityItems.find(item => {
                    const p = item.plate.trim();
                    const r = item.reasonId;
                    return (p !== '' && r === '') || (p === '' && r !== '');
                  });
                  if (incompleteRow) {
                    setSubError("Por favor, preencha a placa e escolha o motivo para todos os itens cadastrados.");
                    return;
                  }

                  const validItems = nonConformityItems.filter(item => item.plate.trim() !== '' && item.reasonId !== '');
                  if (validItems.length === 0) {
                    setSubError("Por favor, informe pelo menos uma placa com seu motivo.");
                    return;
                  }

                  const newNCObjects = validItems.map(item => {
                    const reason = nonConformitiesConfigs.find((c: any) => c.id === item.reasonId);
                    return {
                      id: 'nc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
                      nao_conformidade_id: item.reasonId,
                      nao_conformidade_name: reason ? reason.name : 'Outro',
                      placas: [item.plate.trim().toUpperCase()]
                    };
                  });

                  setLocalNonConformities([...localNonConformities, ...newNCObjects]);
                  setActiveSubView('main');
                }}
                className="flex-1 px-6 py-3 bg-[#5A5A40] text-white rounded-2xl font-medium hover:bg-[#4a4a30] transition-all"
              >
                Salvar Não-Conformidade
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-8 border-b border-[#e5e5e0] flex items-center justify-between">
          <h2 className="text-2xl font-display font-bold tracking-tight">{batch ? 'Editar Lote' : 'Receber Novo Lote'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-[#f5f5f0] rounded-full"><X size={24} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
          {localError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} />
                <p className="text-sm">{localError}</p>
              </div>
              <button type="button" onClick={() => setLocalError(null)}><X size={18} /></button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SearchableSelect 
              label="PAC"
              value={formData.pac}
              options={pacs}
              onChange={(val: string) => setFormData({...formData, pac: val})}
              placeholder="Selecionar PAC"
              required
            />

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-[#5A5A40]">Status</label>
              <select 
                required
                className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl focus:ring-2 focus:ring-[#5A5A40]/20"
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value})}
              >
                <option value="">Selecionar Status</option>
                {statuses.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-[#5A5A40]">Período Inicial</label>
              <input 
                type="date" required
                className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl focus:ring-2 focus:ring-[#5A5A40]/20"
                value={formData.periodoInicial}
                onChange={e => setFormData({...formData, periodoInicial: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-[#5A5A40]">Período Final</label>
              <input 
                type="date" required
                className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl focus:ring-2 focus:ring-[#5A5A40]/20"
                value={formData.periodoFinal}
                onChange={e => setFormData({...formData, periodoFinal: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-[#5A5A40]">Nº de Ensaios</label>
              <input 
                type="number" required
                className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl focus:ring-2 focus:ring-[#5A5A40]/20"
                value={formData.numEnsaios}
                onChange={e => setFormData({...formData, numEnsaios: Number(e.target.value)})}
              />
            </div>
          </div>

          <div className="pt-6 border-t border-[#e5e5e0] space-y-4">
            <h4 className="text-sm font-bold uppercase text-[#5A5A40] opacity-50">Produção</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-[#5A5A40]">Recebido Por</label>
                <select 
                  required
                  className="w-full p-2 bg-[#f5f5f0] border-none rounded-lg text-sm"
                  value={formData.recebidoPor}
                  onChange={e => setFormData({...formData, recebidoPor: e.target.value})}
                >
                  <option value="">-</option>
                  {collaborators.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-[#5A5A40]">Lido Por</label>
                <select 
                  className="w-full p-2 bg-[#f5f5f0] border-none rounded-lg text-sm"
                  value={formData.lidoPor}
                  onChange={e => setFormData({...formData, lidoPor: e.target.value})}
                >
                  <option value="">-</option>
                  {collaborators.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-[#5A5A40]">Informado Por</label>
                <select 
                  className="w-full p-2 bg-[#f5f5f0] border-none rounded-lg text-sm"
                  value={formData.conferidoPor}
                  onChange={e => setFormData({...formData, conferidoPor: e.target.value})}
                >
                  <option value="">-</option>
                  {collaborators.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              {/* Checkbox: ensaio entregue fora do prazo */}
              <div className="col-span-full flex items-center gap-2.5 mt-2 bg-amber-50/40 p-3 rounded-xl border border-dashed border-amber-200">
                <input 
                  type="checkbox"
                  id="ensaioForaDoPrazo"
                  className="h-4 w-4 rounded border-amber-300 text-amber-605 focus:ring-amber-500/30"
                  checked={formData.ensaioForaDoPrazo}
                  onChange={e => setFormData({...formData, ensaioForaDoPrazo: e.target.checked})}
                />
                <label htmlFor="ensaioForaDoPrazo" className="text-xs font-bold text-[#5A5A40] cursor-pointer select-none">
                  ensaio entregue fora do prazo
                </label>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#e5e5e0] space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold uppercase text-[#5A5A40] opacity-50">Lote com Não-Conformidade</h4>
              <button
                type="button"
                onClick={handleIncludeClick}
                className={cn(
                  "px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 border transition-all",
                  formData.pac
                    ? "bg-[#f5f5f0] text-[#5A5A40] border-[#5A5A40]/10 hover:bg-[#e5e5e0]"
                    : "opacity-50 cursor-not-allowed bg-gray-50 text-gray-400 border-gray-200"
                )}
              >
                <Plus size={14} />
                INCLUIR
              </button>
            </div>

            {localNonConformities.length > 0 ? (
              <div className="border border-[#e5e5e0] rounded-2xl overflow-hidden divide-y divide-[#e5e5e0]">
                {localNonConformities.map((item, index) => (
                  <div key={item.id || index} className="p-4 flex justify-between items-center bg-[#f5f5f0]/30 hover:bg-[#f5f5f0]/50 transition-colors animate-in fade-in duration-200">
                    <div>
                      <p className="font-bold text-sm text-[#5A5A40]">{item.nao_conformidade_name}</p>
                      <p className="text-xs text-gray-500 font-mono mt-1">
                        Placas: {item.placas.join(', ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLocalNonConformities(localNonConformities.filter(nc => nc.id !== item.id))}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Nenhuma não-conformidade registrada para este lote.</p>
            )}
          </div>

          <div className="pt-6 flex gap-3 border-t border-[#e5e5e0]">
            <button 
              type="button" onClick={onClose}
              className="flex-1 px-6 py-3 rounded-2xl font-medium border border-[#e5e5e0] hover:bg-[#f5f5f0] transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-1 px-6 py-3 bg-[#5A5A40] text-white rounded-2xl font-medium hover:bg-[#4a4a30] transition-all"
            >
              {batch ? 'Salvar Alterações' : 'Confirmar Recebimento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfigPanel({ 
  pacs, 
  collaborators, 
  statuses, 
  nonConformitiesConfigs,
  nonConformityRecords,
  notificationTypes,
  framings,
  setFramings,
  handleFirestoreError, 
  onUpdate, 
  setConfigToDelete, 
  isLocalMode, 
  batches, 
  setBatches, 
  setPacs, 
  setCollaborators, 
  setStatuses,
  setNonConformitiesConfigs,
  setNotificationTypes,
  logoUrl,
  saveLogoUrl,
  signatures,
  saveSignatures
}: any) {
  const [activeConfig, setActiveConfig] = useState<'pacs' | 'collabs' | 'status' | 'non_conformities' | 'notification_types' | 'import' | 'branding'>('pacs');
  const [newItemName, setNewItemName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // States for enquadramentos
  const [framingSearch, setFramingSearch] = useState('');
  const [newFramingNumber, setNewFramingNumber] = useState('');
  const [newFramingDescription, setNewFramingDescription] = useState('');
  const [editingFramingId, setEditingFramingId] = useState<string | null>(null);
  const [editingFramingNumber, setEditingFramingNumber] = useState('');
  const [editingFramingDescription, setEditingFramingDescription] = useState('');

  // States for linking non-conformity config to framing
  const [selectedFramingId, setSelectedFramingId] = useState('');
  const [editingConfigFramingId, setEditingConfigFramingId] = useState('');
  const [motivoSearch, setMotivoSearch] = useState('');

  // Signature Form States
  const [sigName, setSigName] = useState('');
  const [sigRole, setSigRole] = useState('');
  const [sigImage, setSigImage] = useState('');
  const [editingSigId, setEditingSigId] = useState<string | null>(null);

  // Import State
  const [importLink, setImportLink] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{type: 'success' | 'error' | 'info', message: string} | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Raw / Paste and review states
  const [pastedInput, setPastedInput] = useState('');
  const [previewItems, setPreviewItems] = useState<any[] | null>(null);
  const [isSavingPreview, setIsSavingPreview] = useState(false);

  const checkDuplicates = (itemsToImport: any[], existingBatches: any[]) => {
    const getBatchKeyString = (b: any) => {
      const pacPart = String(b.pac || '').trim().toUpperCase();
      const getTimestampDateStr = (ts: any) => {
        if (!ts) return '';
        let d: Date;
        if (ts.toDate && typeof ts.toDate === 'function') {
          d = ts.toDate();
        } else if (ts instanceof Date) {
          d = ts;
        } else if (typeof ts === 'string') {
          d = new Date(ts);
        } else if (ts.seconds) {
          d = new Date(ts.seconds * 1000);
        } else {
          d = new Date(ts);
        }
        return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
      };
      const pi = getTimestampDateStr(b.periodoInicial);
      const pf = getTimestampDateStr(b.periodoFinal);
      return `${pacPart}__${pi}__${pf}`;
    };

    const existingKeys = new Set(existingBatches.map(b => getBatchKeyString(b)));
    const seenInternalKeys = new Map<string, string[]>();

    const itemsWithDuplicates = itemsToImport.map(item => {
      const itemId = item.id || 'preview-' + Math.random().toString(36).substring(2, 9);
      const key = getBatchKeyString(item);
      
      let isDuplicate = false;
      let duplicateType: 'database' | 'internal' | undefined = undefined;

      if (existingKeys.has(key)) {
        isDuplicate = true;
        duplicateType = 'database';
      }

      if (!seenInternalKeys.has(key)) {
        seenInternalKeys.set(key, [itemId]);
      } else {
        seenInternalKeys.get(key)!.push(itemId);
      }

      return {
        ...item,
        id: itemId,
        isDuplicate,
        duplicateType,
        key
      };
    });

    return itemsWithDuplicates.map(item => {
      const ids = seenInternalKeys.get(item.key) || [];
      if (ids.length > 1) {
        return {
          ...item,
          isDuplicate: true,
          duplicateType: item.duplicateType || 'internal'
        };
      }
      return item;
    });
  };

  const handleAutoRemoveDuplicates = () => {
    if (!previewItems) return;
    const uniqueKeys = new Set<string>();
    const cleaned: any[] = [];
    
    previewItems.forEach(item => {
      if (item.duplicateType === 'database') {
        return;
      }
      if (!uniqueKeys.has(item.key)) {
        uniqueKeys.add(item.key);
        cleaned.push({
          ...item,
          isDuplicate: false,
          duplicateType: undefined
        });
      }
    });

    setPreviewItems(cleaned);
    setImportStatus({
      type: 'success',
      message: `Duplicados removidos. ${cleaned.length} itens prontos para importação.`
    });
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return '-';
    let d: Date;
    if (ts.toDate && typeof ts.toDate === 'function') {
      d = ts.toDate();
    } else if (ts instanceof Date) {
      d = ts;
    } else if (typeof ts === 'string') {
      d = new Date(ts);
    } else if (ts.seconds) {
      d = new Date(ts.seconds * 1000);
    } else {
      d = new Date(ts);
    }
    return isNaN(d.getTime()) ? '-' : format(d, 'dd/MM/yyyy');
  };

  const handleOneDriveLink = (url: string) => {
    // Basic conversion for OneDrive links
    if (url.includes('onedrive.live.com/view.aspx')) {
      return url.replace('view.aspx', 'download.aspx');
    }
    if (url.includes('1drv.ms')) {
      // Short links are hard to convert without a proxy, but we can try adding ?download=1
      return url + (url.includes('?') ? '&' : '?') + 'download=1';
    }
    return url;
  };

  const cleanString = (val: any): string => {
    if (val === null || val === undefined) return '';
    const s = String(val).trim();
    const lower = s.toLowerCase();
    if (lower === 'null' || lower === 'undefined' || lower === '-' || lower === 'n/a' || lower === 'na') {
      return '';
    }
    return s;
  };

  const parseCSV = (buffer: ArrayBuffer): any[] => {
    let text = '';
    try {
      text = new TextDecoder('utf-8').decode(buffer);
      if (text.includes('') || text.includes('')) {
        text = new TextDecoder('windows-1252').decode(buffer);
      }
    } catch (e) {
      text = new TextDecoder('windows-1252').decode(buffer);
    }

    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) {
      throw new Error('O arquivo CSV está vazio.');
    }

    // Sniff delimiter
    const firstLine = lines[0];
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    const parseCSVLine = (line: string, delim: string) => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delim && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0], delimiter);
    const data = lines.slice(1).map(line => {
      const values = parseCSVLine(line, delimiter);
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] !== undefined ? values[index] : '';
      });
      return row;
    });

    return data;
  };

  const processParsedDataObjects = async (data: any[]) => {
    try {
      if (data.length === 0) {
        throw new Error('Nenhum dado legível foi encontrado.');
      }

      const parsedItems: any[] = [];

      for (const row of data) {
        // Mapping columns based on user's specific headers (case-insensitive support)
        const getVal = (names: string[]) => {
          for (const name of names) {
            if (row[name] !== undefined) return row[name];
            // Also check uppercase/lowercase variations and trim spaces
            const found = Object.keys(row).find(k => k.trim().toLowerCase() === name.toLowerCase());
            if (found) return row[found];
          }
          return undefined;
        };

        const parseExcelDate = (val: any) => {
          if (!val) return null;
          
          if (val instanceof Date) {
            return isNaN(val.getTime()) ? null : Timestamp.fromDate(val);
          }

          if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed === '') return null;

            if (trimmed.includes('T')) {
              const d = new Date(trimmed);
              if (!isNaN(d.getTime())) return Timestamp.fromDate(d);
            }

            const datePart = trimmed.split(' ')[0];
            if (datePart.includes('/') || datePart.includes('-')) {
              const separator = datePart.includes('/') ? '/' : '-';
              const parts = datePart.split(separator);
              if (parts.length === 3) {
                const first = parseInt(parts[0], 10);
                const second = parseInt(parts[1], 10);
                const third = parseInt(parts[2], 10);
                
                if (!isNaN(first) && !isNaN(second) && !isNaN(third)) {
                  let day = first;
                  let month = second - 1;
                  let year = third;
                  
                  if (first > 1000) { // YYYY-MM-DD
                    year = first;
                    month = second - 1;
                    day = third;
                  }

                  if (year < 100) { // 2-digit year
                    year += 2000;
                  }
                  
                  const date = new Date(year, month, day);
                  if (!isNaN(date.getTime())) return Timestamp.fromDate(date);
                }
              }
            }
          }

          if (typeof val === 'number') {
            const date = new Date((val - 25569) * 86400 * 1000);
            if (!isNaN(date.getTime())) return Timestamp.fromDate(date);
          }

          const date = new Date(val);
          return isNaN(date.getTime()) ? null : Timestamp.fromDate(date);
        };

        const pac = cleanString(getVal(['PAC', 'Pacote', 'Lote', 'Identificação', 'Identificacao']));
        const periodoInicialVal = getVal(['PERÍODO INICIAL', 'Periodo Inicial', 'Data Inicial', 'Inicio', 'Início', 'Data de Inicio', 'Data de Início']);
        const periodoFinalVal = getVal(['PERÍODO FINAL', 'Periodo Final', 'Data Final', 'Fim', 'Data de Fim', 'Término', 'Termino']);
        const numEnsaios = Number(getVal(['Nº DE ENSAIOS', 'Ensaios', 'Nº Ensaios', 'Quantidade', 'Nº de Ensaios', 'Numero de Ensaios', 'Num Ensaios']) || 0);

        const statusVal = cleanString(getVal(['status', 'Status', 'Situação', 'Situacao']) || 'ABERTO');
        const recebidoPor = cleanString(getVal(['RECEBIDO POR', 'Recebido Por', 'Responsável', 'Responsavel', 'Cadastrado Por']) || 'Sistema');
        const recebidoEmVal = getVal(['recebido em', 'Recebido Em', 'Data Recebimento', 'Data de Recebimento', 'RecebidoNoDia']);
        
        const lidoPor = cleanString(getVal(['LIDO POR', 'Lido Por', 'Regularizado Por', 'Lido', 'LidoPor']));
        const lidoEmVal = getVal(['lido em', 'Lido Em', 'Regularizado Em', 'Data Regularização', 'Data Regularizacao', 'Data Lido', 'LidoEm']);
        
        const conferidoPor = cleanString(getVal(['CONFERIDO POR', 'Conferido Por', 'Fechado Por', 'Informado Por', 'Informado', 'Conferido', 'ConferidoPor', 'InformadoPor']));
        const conferidoEmVal = getVal(['conferido em', 'Conferido Em', 'Fechado Em', 'Data Fechamento', 'Informado Em', 'InformadoEm', 'ConferidoEm']);
        
        const pInicial = parseExcelDate(periodoInicialVal);
        const pFinal = parseExcelDate(periodoFinalVal);
        const rEm = parseExcelDate(recebidoEmVal);
        const lEm = parseExcelDate(lidoEmVal);
        const cEm = parseExcelDate(conferidoEmVal);

        let status = 'ABERTO';
        const rawStatus = statusVal.toUpperCase().trim();
        if (rawStatus === 'ABERTO' || rawStatus === 'EM ABERTO' || rawStatus === 'ABERTA') {
          status = 'ABERTO';
        } else if (rawStatus === 'ALERTA') {
          status = 'ALERTA';
        } else if (rawStatus === 'ATRASO') {
          status = 'ATRASO';
        } else if (rawStatus === 'EM ANDAMENTO' || rawStatus === 'ANDAMENTO') {
          status = 'EM ANDAMENTO';
        } else if (rawStatus === 'FINALIZADO' || rawStatus === 'CONCLUÍDO' || rawStatus === 'CONCLUIDO' || rawStatus === 'FINALIZADA') {
          status = 'FINALIZADO';
        } else if (rawStatus) {
          status = rawStatus;
        }

        if (conferidoPor && conferidoPor.trim() !== '') {
          status = 'FINALIZADO';
        } else if (status === 'FINALIZADO') {
          status = 'ABERTO';
        }

        const batchData = {
          pac,
          periodoInicial: pInicial || Timestamp.now(),
          periodoFinal: pFinal || Timestamp.now(),
          numEnsaios,
          status,
          recebidoPor,
          recebidoEm: rEm || Timestamp.now(),
          lidoPor,
          lidoEm: lEm || (lidoPor ? Timestamp.now() : null),
          conferidoPor,
          conferidoEm: cEm || (conferidoPor ? Timestamp.now() : null)
        };

        if (batchData.pac) {
          parsedItems.push(batchData);
        }
      }

      if (parsedItems.length === 0) {
        throw new Error('Nenhum lote válido com coluna "PAC" foi encontrado.');
      }

      const previewWithDuplicates = checkDuplicates(parsedItems, batches);
      setPreviewItems(previewWithDuplicates);
      setImportStatus({ 
        type: 'info', 
        message: `Sucesso! Extraímos ${previewWithDuplicates.length} registros. Por favor, revise os dados e decida sobre as duplicatas abaixo antes de salvar.` 
      });
    } catch (err: any) {
      setImportStatus({ type: 'error', message: `Erro ao analisar dados: ${err.message}` });
    } finally {
      setIsImporting(false);
    }
  };

  const processExcelData = async (buffer: ArrayBuffer, isCsv = false) => {
    try {
      let data: any[] = [];
      if (isCsv) {
        data = parseCSV(buffer);
      } else {
        const workbook = read(buffer, { cellDates: true });
        
        let targetSheetName = workbook.SheetNames.find(name => 
          name.trim().toUpperCase() === 'PRODUÇÃO' || 
          name.trim().toUpperCase() === 'PRODUCAO'
        );

        if (!targetSheetName) {
          if (workbook.SheetNames.length === 1) {
            targetSheetName = workbook.SheetNames[0];
          } else {
            throw new Error('A aba "PRODUÇÃO" não foi encontrada na planilha.');
          }
        }

        const worksheet = workbook.Sheets[targetSheetName];
        data = utils.sheet_to_json(worksheet) as any[];
      }

      await processParsedDataObjects(data);
    } catch (err: any) {
      setImportStatus({ type: 'error', message: `Erro ao processar arquivo: ${err.message}` });
      setIsImporting(false);
    }
  };

  const handlePastedImport = async () => {
    if (!pastedInput.trim()) return;
    setIsImporting(true);
    setImportStatus({ type: 'info', message: 'Analisando dados colados...' });

    try {
      const lines = pastedInput.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length === 0) {
        throw new Error('Texto colado está vazio.');
      }

      const parsedRows = lines.map(line => {
        if (line.includes('\t')) {
          return line.split('\t');
        } else if (line.includes(';')) {
          return line.split(';');
        } else if (line.includes(',')) {
          return line.split(',');
        } else {
          const parts = line.split(/\s{2,}/);
          if (parts.length > 1) {
            return parts;
          }
          return [line];
        }
      });

      const firstLine = parsedRows[0];
      const isHeader = firstLine.some(cell => {
        const c = String(cell).toLowerCase().trim();
        return c === 'pac' || c.includes('período') || c.includes('periodo') || c.includes('ensaios') || c === 'status' || c.includes('recebido');
      });

      let headers: string[] = [];
      let rawData: string[][] = [];

      if (isHeader) {
        headers = firstLine.map(h => h.trim());
        rawData = parsedRows.slice(1);
      } else {
        headers = ['PAC', 'PERÍODO INICIAL', 'PERÍODO FINAL', 'Nº DE ENSAIOS', 'status', 'RECEBIDO POR', 'recebido em', 'LIDO POR', 'lido em', 'CONFERIDO POR', 'conferido em'];
        rawData = parsedRows;
      }

      const dataObjects = rawData.map(row => {
        const obj: any = {};
        headers.forEach((header, idx) => {
          obj[header] = row[idx] !== undefined ? row[idx].trim() : '';
        });
        return obj;
      });

      await processParsedDataObjects(dataObjects);
    } catch (err: any) {
      setImportStatus({ type: 'error', message: `Erro ao processar as células: ${err.message}` });
      setIsImporting(false);
    }
  };

  const handleSavePreview = async () => {
    if (!previewItems || previewItems.length === 0) return;
    setIsSavingPreview(true);
    setImportStatus({ type: 'info', message: 'Salvando lotes no banco de dados...' });

    try {
      let importedCount = 0;
      const foundPacs = new Set<string>();
      const foundCollaborators = new Set<string>();
      const foundStatuses = new Set<string>();

      const batchesToSave = [...previewItems];
      const importedLocalBatches: any[] = [];

      const chunks: any[][] = [];
      for (let i = 0; i < batchesToSave.length; i += 400) {
        chunks.push(batchesToSave.slice(i, i + 400));
      }

      for (const chunk of chunks) {
        if (isLocalMode) {
          chunk.forEach(item => {
            const newId = 'local-imp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
            const { id, isDuplicate, duplicateType, key, ...cleanData } = item;
            importedLocalBatches.push({ id: newId, ...cleanData } as Batch);
            importedCount++;

            if (cleanData.pac) foundPacs.add(cleanData.pac);
            if (cleanData.recebidoPor) foundCollaborators.add(cleanData.recebidoPor);
            if (cleanData.lidoPor) foundCollaborators.add(cleanData.lidoPor);
            if (cleanData.conferidoPor) foundCollaborators.add(cleanData.conferidoPor);
            if (cleanData.status) foundStatuses.add(cleanData.status);
          });
        } else {
          const batch = writeBatch(db);
          chunk.forEach(item => {
            const { id, isDuplicate, duplicateType, key, ...cleanData } = item;
            const docRef = doc(collection(db, 'batches'));
            batch.set(docRef, { ...cleanData, createdAt: Timestamp.now() });
            importedCount++;

            if (cleanData.pac) foundPacs.add(cleanData.pac);
            if (cleanData.recebidoPor) foundCollaborators.add(cleanData.recebidoPor);
            if (cleanData.lidoPor) foundCollaborators.add(cleanData.lidoPor);
            if (cleanData.conferidoPor) foundCollaborators.add(cleanData.conferidoPor);
            if (cleanData.status) foundStatuses.add(cleanData.status);
          });
          await batch.commit().catch(err => {
            handleFirestoreError(err, OperationType.WRITE, 'batches');
          });
        }
      }

      if (isLocalMode) {
        const currentPacNames = pacs.map((p: any) => p.name.trim().toLowerCase());
        const currentCollabNames = collaborators.map((c: any) => c.name.trim().toLowerCase());
        const currentStatusNames = statuses.map((s: any) => s.name.trim().toLowerCase());

        let pacsUpdated = false;
        let collabsUpdated = false;
        let statusesUpdated = false;

        const newPacsList = [...pacs];
        const newCollabsList = [...collaborators];
        const newStatusesList = [...statuses];

        foundPacs.forEach(p => {
          if (p && !currentPacNames.includes(p.toLowerCase())) {
            newPacsList.push({ id: 'local-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5), name: p });
            pacsUpdated = true;
          }
        });

        foundCollaborators.forEach(c => {
          if (c && !currentCollabNames.includes(c.toLowerCase())) {
            newCollabsList.push({ id: 'local-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5), name: c });
            collabsUpdated = true;
          }
        });

        foundStatuses.forEach(s => {
          if (s && !currentStatusNames.includes(s.toLowerCase())) {
            newStatusesList.push({ id: 'local-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5), name: s, color: '#6B7280' });
            statusesUpdated = true;
          }
        });

        if (pacsUpdated) {
          const sorted = newPacsList.sort((a, b) => a.name.localeCompare(b.name));
          setPacs(sorted);
          localStorage.setItem('lotes_pacs', JSON.stringify(sorted));
        }
        if (collabsUpdated) {
          const sorted = newCollabsList.sort((a, b) => a.name.localeCompare(b.name));
          setCollaborators(sorted);
          localStorage.setItem('lotes_collaborators', JSON.stringify(sorted));
        }
        if (statusesUpdated) {
          const sorted = newStatusesList.sort((a, b) => a.name.localeCompare(b.name));
          setStatuses(sorted);
          localStorage.setItem('lotes_statuses', JSON.stringify(sorted));
        }

        const finalizedLocalBatches = importedLocalBatches.map((b: any) => ({
          ...b,
          periodoInicial: parseLocalTimestamp(b.periodoInicial),
          periodoFinal: parseLocalTimestamp(b.periodoFinal),
          recebidoEm: parseLocalTimestamp(b.recebidoEm),
          lidoEm: parseLocalTimestamp(b.lidoEm),
          conferidoEm: parseLocalTimestamp(b.conferidoEm),
          createdAt: Timestamp.now()
        }));
        const updated = [...finalizedLocalBatches, ...batches];
        setBatches(updated);
        localStorage.setItem('lotes_batches', JSON.stringify(updated));
      } else {
        const currentPacNames = pacs.map((p: any) => p.name.trim().toLowerCase());
        const currentCollabNames = collaborators.map((c: any) => c.name.trim().toLowerCase());
        const currentStatusNames = statuses.map((s: any) => s.name.trim().toLowerCase());

        for (const p of foundPacs) {
          if (p && !currentPacNames.includes(p.toLowerCase())) {
            await addDoc(collection(db, 'pacs'), { name: p });
          }
        }

        for (const c of foundCollaborators) {
          if (c && !currentCollabNames.includes(c.toLowerCase())) {
            await addDoc(collection(db, 'collaborators'), { name: c });
          }
        }

        for (const s of foundStatuses) {
          if (s && !currentStatusNames.includes(s.toLowerCase())) {
            await addDoc(collection(db, 'statuses'), { name: s, color: '#6B7280' });
          }
        }
      }

      setImportStatus({ type: 'success', message: `${importedCount} lotes importados e salvos com sucesso!` });
      setPreviewItems(null);
      setPastedInput('');
    } catch (err: any) {
      setImportStatus({ type: 'error', message: `Erro ao salvar os lotes: ${err.message}` });
    } finally {
      setIsSavingPreview(false);
    }
  };

  const handleLinkImport = async () => {
    if (!importLink) return;
    setIsImporting(true);
    setImportStatus({ type: 'info', message: 'Baixando planilha...' });

    try {
      const directLink = handleOneDriveLink(importLink);
      const response = await fetch(directLink);
      if (!response.ok) throw new Error('Não foi possível baixar o arquivo. Verifique se o link é público e permite download direto.');
      
      const buffer = await response.arrayBuffer();
      const isCsv = importLink.toLowerCase().split('?')[0].split('#')[0].endsWith('.csv');
      await processExcelData(buffer, isCsv);
    } catch (err: any) {
      setImportStatus({ 
        type: 'error', 
        message: 'Erro ao baixar link. Dica: Use a opção de upload direto se o link do OneDrive estiver bloqueado por CORS.' 
      });
      setIsImporting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus({ type: 'info', message: 'Lendo arquivo...' });

    try {
      const buffer = await file.arrayBuffer();
      const isCsv = file.name.toLowerCase().endsWith('.csv');
      await processExcelData(buffer, isCsv);
    } catch (err: any) {
      setImportStatus({ type: 'error', message: `Erro no upload: ${err.message}` });
      setIsImporting(false);
    }
  };

  const handleDeleteAllBatches = async () => {
    setIsDeletingAll(true);
    try {
      if (isLocalMode) {
        setBatches([]);
        localStorage.setItem('lotes_batches', JSON.stringify([]));
        setImportStatus({ type: 'success', message: 'Todos os lotes foram excluídos com sucesso.' });
        setShowDeleteAllConfirm(false);
        return;
      }
      const snapshot = await getDocs(collection(db, 'batches'));
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      setImportStatus({ type: 'success', message: 'Todos os lotes foram excluídos com sucesso.' });
      setShowDeleteAllConfirm(false);
    } catch (err: any) {
      setImportStatus({ type: 'error', message: `Erro ao excluir lotes: ${err.message}` });
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleAdd = async () => {
    if (!newItemName) return;
    const collectionName = 
      activeConfig === 'pacs' ? 'pacs' : 
      activeConfig === 'collabs' ? 'collaborators' : 
      activeConfig === 'status' ? 'statuses' : 
      activeConfig === 'notification_types' ? 'notification_types' : 'non_conformities_configs';
    if (isLocalMode) {
      const newItem = {
        id: 'local-cfg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
        name: newItemName
      };
      if (collectionName === 'pacs') {
        const sorted = [...pacs, newItem].sort((a, b) => a.name.localeCompare(b.name));
        setPacs(sorted);
        localStorage.setItem('lotes_pacs', JSON.stringify(sorted));
      } else if (collectionName === 'collaborators') {
        const sorted = [...collaborators, newItem].sort((a, b) => a.name.localeCompare(b.name));
        setCollaborators(sorted);
        localStorage.setItem('lotes_collaborators', JSON.stringify(sorted));
      } else if (collectionName === 'statuses') {
        const sorted = [...statuses, newItem].sort((a, b) => a.name.localeCompare(b.name));
        setStatuses(sorted);
        localStorage.setItem('lotes_statuses', JSON.stringify(sorted));
      } else if (collectionName === 'notification_types') {
        const sorted = [...notificationTypes, newItem].sort((a, b) => a.name.localeCompare(b.name));
        setNotificationTypes(sorted);
        localStorage.setItem('lotes_notification_types', JSON.stringify(sorted));
      } else {
        const selectedFraming = framings.find((f: any) => f.id === selectedFramingId);
        const newItemWithFraming = {
          ...newItem,
          framingId: selectedFramingId || '',
          framingNumber: selectedFraming ? selectedFraming.number : '',
          framingDescription: selectedFraming ? selectedFraming.description : ''
        };
        const sorted = [...nonConformitiesConfigs, newItemWithFraming].sort((a, b) => a.name.localeCompare(b.name));
        setNonConformitiesConfigs(sorted);
        localStorage.setItem('lotes_non_conformities_configs', JSON.stringify(sorted));
      }
      setNewItemName('');
      setSelectedFramingId('');
      return;
    }
    try {
      const dataToAdd: any = { name: newItemName };
      if (collectionName === 'non_conformities_configs') {
        const selectedFraming = framings.find((f: any) => f.id === selectedFramingId);
        dataToAdd.framingId = selectedFramingId || '';
        dataToAdd.framingNumber = selectedFraming ? selectedFraming.number : '';
        dataToAdd.framingDescription = selectedFraming ? selectedFraming.description : '';
      }
      await addDoc(collection(db, collectionName), dataToAdd);
      setNewItemName('');
      setSelectedFramingId('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, collectionName);
    }
  };

  const handleCopyNotificationType = async (item: any) => {
    const copyName = `${item.name} - Cópia`;
    const templatesCopy = item.templates ? JSON.parse(JSON.stringify(item.templates)) : null;

    if (isLocalMode) {
      const copiedItem = {
        id: 'local-cfg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
        name: copyName,
        templates: templatesCopy
      };
      const sorted = [...notificationTypes, copiedItem].sort((a, b) => a.name.localeCompare(b.name));
      setNotificationTypes(sorted);
      localStorage.setItem('lotes_notification_types', JSON.stringify(sorted));
      return;
    }

    try {
      await addDoc(collection(db, 'notification_types'), {
        name: copyName,
        templates: templatesCopy
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'notification_types');
    }
  };

  const handleDelete = (id: string) => {
    const collectionName = 
      activeConfig === 'pacs' ? 'pacs' : 
      activeConfig === 'collabs' ? 'collaborators' : 
      activeConfig === 'status' ? 'statuses' : 
      activeConfig === 'notification_types' ? 'notification_types' : 'non_conformities_configs';
    setConfigToDelete({ type: collectionName, id });
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setEditingValue(item.name);
    if (activeConfig === 'non_conformities') {
      setEditingConfigFramingId(item.framingId || '');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingValue.trim()) return;
    const collectionName = 
      activeConfig === 'pacs' ? 'pacs' : 
      activeConfig === 'collabs' ? 'collaborators' : 
      activeConfig === 'status' ? 'statuses' : 
      activeConfig === 'notification_types' ? 'notification_types' : 'non_conformities_configs';
    
    let extraFields: any = undefined;
    if (collectionName === 'non_conformities_configs') {
      const selectedFraming = framings.find((f: any) => f.id === editingConfigFramingId);
      extraFields = {
        framingId: editingConfigFramingId || '',
        framingNumber: selectedFraming ? selectedFraming.number : '',
        framingDescription: selectedFraming ? selectedFraming.description : ''
      };
    }

    try {
      await onUpdate(collectionName, editingId, editingValue.trim(), extraFields);
      setEditingId(null);
      setEditingValue('');
      setEditingConfigFramingId('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${editingId}`);
    }
  };

  const handleAddFraming = async () => {
    if (!newFramingNumber.trim() || !newFramingDescription.trim()) return;
    
    if (isLocalMode) {
      const newFraming = {
        id: 'local-framing-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
        number: newFramingNumber.trim(),
        description: newFramingDescription.trim()
      };
      const updated = [...framings, newFraming].sort((a, b) => a.number.localeCompare(b.number));
      setFramings(updated);
      localStorage.setItem('lotes_framings', JSON.stringify(updated));
      setNewFramingNumber('');
      setNewFramingDescription('');
      return;
    }
    
    try {
      await addDoc(collection(db, 'framings'), {
        number: newFramingNumber.trim(),
        description: newFramingDescription.trim()
      });
      setNewFramingNumber('');
      setNewFramingDescription('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'framings');
    }
  };

  const handleStartEditFraming = (f: any) => {
    setEditingFramingId(f.id);
    setEditingFramingNumber(f.number);
    setEditingFramingDescription(f.description);
  };

  const handleSaveEditFraming = async () => {
    if (!editingFramingId || !editingFramingNumber.trim() || !editingFramingDescription.trim()) return;
    
    if (isLocalMode) {
      const updated = framings.map(f => f.id === editingFramingId ? {
        ...f,
        number: editingFramingNumber.trim(),
        description: editingFramingDescription.trim()
      } : f).sort((a, b) => a.number.localeCompare(b.number));
      
      setFramings(updated);
      localStorage.setItem('lotes_framings', JSON.stringify(updated));
      
      // Update linked values in non_conformities_configs
      const updatedNCConfigs = nonConformitiesConfigs.map((nc: any) => {
        if (nc.framingId === editingFramingId) {
          return {
            ...nc,
            framingNumber: editingFramingNumber.trim(),
            framingDescription: editingFramingDescription.trim()
          };
        }
        return nc;
      });
      setNonConformitiesConfigs(updatedNCConfigs);
      localStorage.setItem('lotes_non_conformities_configs', JSON.stringify(updatedNCConfigs));

      setEditingFramingId(null);
      setEditingFramingNumber('');
      setEditingFramingDescription('');
      return;
    }
    
    try {
      await updateDoc(doc(db, 'framings', editingFramingId), {
        number: editingFramingNumber.trim(),
        description: editingFramingDescription.trim()
      });
      
      // Also update matching configs in Firestore
      const matching = nonConformitiesConfigs.filter((nc: any) => nc.framingId === editingFramingId);
      for (const m of matching) {
        await updateDoc(doc(db, 'non_conformities_configs', m.id), {
          framingNumber: editingFramingNumber.trim(),
          framingDescription: editingFramingDescription.trim()
        });
      }

      setEditingFramingId(null);
      setEditingFramingNumber('');
      setEditingFramingDescription('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `framings/${editingFramingId}`);
    }
  };

  const handleDeleteFraming = async (id: string) => {
    if (isLocalMode) {
      const updated = framings.filter(f => f.id !== id);
      setFramings(updated);
      localStorage.setItem('lotes_framings', JSON.stringify(updated));
      
      // Remove linked enquadramento from configs
      const updatedNCConfigs = nonConformitiesConfigs.map((nc: any) => {
        if (nc.framingId === id) {
          return {
            ...nc,
            framingId: '',
            framingNumber: '',
            framingDescription: ''
          };
        }
        return nc;
      });
      setNonConformitiesConfigs(updatedNCConfigs);
      localStorage.setItem('lotes_non_conformities_configs', JSON.stringify(updatedNCConfigs));
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'framings', id));
      
      // Also clear fields in matched docs
      const matching = nonConformitiesConfigs.filter((nc: any) => nc.framingId === id);
      for (const m of matching) {
        await updateDoc(doc(db, 'non_conformities_configs', m.id), {
          framingId: '',
          framingNumber: '',
          framingDescription: ''
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `framings/${id}`);
    }
  };

  const sortedNonConformitiesConfigs = [...(nonConformitiesConfigs || [])].sort((a, b) => 
    (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' })
  );

  const sortedFramings = [...(framings || [])].sort((a, b) => {
    const numCompare = (a.number || '').localeCompare(b.number || '', 'pt-BR', { numeric: true, sensitivity: 'base' });
    if (numCompare !== 0) return numCompare;
    return (a.description || '').localeCompare(b.description || '', 'pt-BR', { sensitivity: 'base' });
  });

  const baseItems = 
    activeConfig === 'pacs' ? pacs : 
    activeConfig === 'collabs' ? collaborators : 
    activeConfig === 'status' ? statuses : 
    activeConfig === 'notification_types' ? notificationTypes : sortedNonConformitiesConfigs;

  const items = baseItems.filter((item: any) => {
    if (activeConfig === 'non_conformities' && motivoSearch.trim() !== '') {
      const q = motivoSearch.toLowerCase().trim();
      return (item.name || '').toLowerCase().includes(q) || 
             (item.framingNumber || '').toLowerCase().includes(q) || 
             (item.framingDescription || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="bg-white rounded-[32px] p-8 border border-[#e5e5e0]">
      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => setActiveConfig('pacs')}
          className={cn("px-4 py-2 rounded-full text-sm font-bold", activeConfig === 'pacs' ? "bg-[#5A5A40] text-white" : "bg-[#f5f5f0] text-[#5A5A40]")}
        >
          PACs
        </button>
        <button 
          onClick={() => setActiveConfig('collabs')}
          className={cn("px-4 py-2 rounded-full text-sm font-bold", activeConfig === 'collabs' ? "bg-[#5A5A40] text-white" : "bg-[#f5f5f0] text-[#5A5A40]")}
        >
          Colaboradores
        </button>
        <button 
          onClick={() => setActiveConfig('status')}
          className={cn("px-4 py-2 rounded-full text-sm font-bold", activeConfig === 'status' ? "bg-[#5A5A40] text-white" : "bg-[#f5f5f0] text-[#5A5A40]")}
        >
          Status
        </button>
        <button 
          onClick={() => setActiveConfig('non_conformities')}
          className={cn("px-4 py-2 rounded-full text-sm font-bold", activeConfig === 'non_conformities' ? "bg-[#5A5A40] text-white" : "bg-[#f5f5f0] text-[#5A5A40]")}
        >
          Motivos de Não-Conformidade
        </button>
        <button 
          onClick={() => setActiveConfig('notification_types')}
          className={cn("px-4 py-2 rounded-full text-sm font-bold", activeConfig === 'notification_types' ? "bg-[#5A5A40] text-white" : "bg-[#f5f5f0] text-[#5A5A40]")}
        >
          Tipos de Notificações
        </button>
        <button 
          onClick={() => setActiveConfig('import')}
          className={cn("px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2", activeConfig === 'import' ? "bg-[#5A5A40] text-white" : "bg-[#f5f5f0] text-[#5A5A40]")}
        >
          <FileSpreadsheet size={16} />
          Importar
        </button>
        <button 
          onClick={() => setActiveConfig('branding')}
          className={cn("px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2", activeConfig === 'branding' ? "bg-[#5A5A40] text-white" : "bg-[#f5f5f0] text-[#5A5A40]")}
        >
          <Upload size={16} />
          Identidade Visual
        </button>
      </div>

      {activeConfig === 'import' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#f5f5f0] p-6 rounded-2xl border border-dashed border-[#5A5A40]/20">
            <h4 className="font-display font-bold tracking-tight text-lg mb-2">Importar de Planilha</h4>
              <p className="text-sm text-[#5A5A40]/70 mb-6">
                Carregue seus dados iniciais via link do OneDrive ou arquivo local (.xlsx, .xls, .csv).
                O sistema irá ler <strong>somente a aba nomeada como "PRODUÇÃO"</strong>.
                A planilha deve conter as colunas: <span className="font-mono font-bold">PAC, PERÍODO INICIAL, PERÍODO FINAL, Nº DE ENSAIOS, status, RECEBIDO POR, recebido em, LIDO POR, lido em, CONFERIDO POR, conferido em</span>.
                Se os campos de fluxo (Lido e Informado) estiverem preenchidos, o status será automaticamente definido como <span className="font-bold text-emerald-600">FINALIZADO</span>.
              </p>

            <div className="space-y-6">
              {/* Link Import */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase opacity-50">Link do OneDrive / Web</label>
                <div className="flex gap-2">
                  <input 
                    type="url" 
                    placeholder="https://onedrive.live.com/..."
                    className="flex-1 p-3 bg-white border border-[#e5e5e0] rounded-xl text-sm"
                    value={importLink}
                    onChange={e => setImportLink(e.target.value)}
                  />
                  <button 
                    onClick={handleLinkImport}
                    disabled={isImporting || !importLink}
                    className="bg-[#5A5A40] text-white px-6 rounded-xl font-bold hover:bg-[#4a4a30] disabled:opacity-50 flex items-center gap-2"
                  >
                    {isImporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                    Importar Link
                  </button>
                </div>
              </div>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#e5e5e0]"></div></div>
                <div className="relative flex justify-center text-xs uppercase font-bold text-[#5A5A40]/40"><span className="bg-[#f5f5f0] px-2">Ou</span></div>
              </div>

              {/* File Upload */}
              <div className="flex justify-center">
                <label className="w-full cursor-pointer group">
                  <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-[#e5e5e0] rounded-2xl group-hover:border-[#5A5A40]/40 transition-all bg-white">
                    <Upload className="text-[#5A5A40]/40 group-hover:text-[#5A5A40] mb-2 transition-colors" size={32} />
                    <span className="text-sm font-medium text-[#5A5A40]/60 group-hover:text-[#5A5A40]">Clique para selecionar arquivo (.xlsx, .xls, .csv)</span>
                    <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} disabled={isImporting} />
                  </div>
                </label>
              </div>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#e5e5e0]"></div></div>
                <div className="relative flex justify-center text-xs uppercase font-bold text-[#5A5A40]/40"><span className="bg-[#f5f5f0] px-2">Ou se preferir</span></div>
              </div>

              {/* Paste Cells Option */}
              <div className="space-y-2 bg-white p-6 rounded-2xl border border-[#e5e5e0]">
                <label className="text-xs font-bold uppercase text-[#5A5A40]">Colar Células Copiadas do Excel / Sheets</label>
                <p className="text-xs text-[#5A5A40]/60">
                  Selecione as células na sua planilha, copie (Ctrl+C) e cole (Ctrl+V) no campo abaixo.
                  Utilizamos as colunas parâmetros de cabeçalho: <span className="font-mono bg-gray-100 px-1 rounded text-[11px]">PAC, PERÍODO INICIAL, PERÍODO FINAL, Nº DE ENSAIOS, status, RECEBIDO POR, recebido em, LIDO POR, lido em, CONFERIDO POR, conferido em</span>.
                </p>
                <textarea
                  rows={5}
                  placeholder="Cole aqui... Exemplo:&#10;LOTE-001	01/01/2026	10/01/2026	15	ABERTO	Operador 1"
                  className="w-full p-4 bg-[#f5f5f0] border border-[#e5e5e0] rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#5A5A40]/20 focus:outline-none"
                  value={pastedInput}
                  onChange={e => setPastedInput(e.target.value)}
                />
                <button
                  onClick={handlePastedImport}
                  disabled={isImporting || !pastedInput.trim()}
                  className="w-full bg-[#5A5A40] text-white py-3 rounded-xl font-bold hover:bg-[#4a4a30] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isImporting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                  Analisar e Importar Células Coladas
                </button>
              </div>

              {/* Review and Preview Screen */}
              {previewItems && (
                <div className="bg-white rounded-2xl p-6 border border-[#e5e5e0] space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#e5e5e0] pb-4">
                    <div>
                      <h4 className="font-display font-bold text-lg text-[#5A5A40]">Revisão de Dados Extraídos</h4>
                      <p className="text-sm text-[#5A5A40]/70">
                        Lotes identificados: <span className="font-bold text-[#5A5A40]">{previewItems.length}</span>. 
                        Duplicatas: <span className="font-bold text-red-600">{previewItems.filter(item => item.isDuplicate).length}</span>.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      {previewItems.some(item => item.isDuplicate) && (
                        <button
                          onClick={handleAutoRemoveDuplicates}
                          className="flex-1 sm:flex-initial bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1"
                          title="Filtra duplicados e mantém apenas cópias únicas não salvas"
                        >
                          <Trash2 size={14} />
                          Remover Duplicados
                        </button>
                      )}
                      <button
                        onClick={handleSavePreview}
                        disabled={isSavingPreview}
                        className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {isSavingPreview ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                        Salvar Lotes no Banco ({previewItems.length})
                      </button>
                      <button
                        onClick={() => {
                          setPreviewItems(null);
                          setImportStatus(null);
                        }}
                        className="flex-1 sm:flex-initial bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3 py-2 rounded-xl transition-all"
                      >
                        Descartar
                      </button>
                    </div>
                  </div>

                  <div className="border border-[#e5e5e0] rounded-xl overflow-hidden">
                    <div className="max-h-96 overflow-y-auto overflow-x-auto">
                      <table className="min-w-full divide-y divide-[#e5e5e0] text-xs text-left">
                        <thead className="bg-[#f5f5f0] text-[#5A5A40] font-bold sticky top-0 z-10">
                          <tr>
                            <th className="p-3">PAC</th>
                            <th className="p-3">Período Inicial</th>
                            <th className="p-3">Período Final</th>
                            <th className="p-3">Ensaios</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Tipo Duplicata</th>
                            <th className="p-3 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e5e5e0]">
                          {previewItems.map((item, index) => {
                            const rowId = item.id || `preview-row-${index}`;
                            return (
                              <tr 
                                key={rowId}
                                className={cn(
                                  "hover:bg-gray-50/50 transition-colors",
                                  item.isDuplicate ? "bg-red-50/80" : ""
                                )}
                              >
                                <td className="p-3 font-mono font-bold text-gray-800">{item.pac}</td>
                                <td className="p-3">{formatTimestamp(item.periodoInicial)}</td>
                                <td className="p-3">{formatTimestamp(item.periodoFinal)}</td>
                                <td className="p-3 font-mono">{item.numEnsaios}</td>
                                <td className="p-3">
                                  <span className="bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                                    {item.status}
                                  </span>
                                </td>
                                <td className="p-3">
                                  {item.isDuplicate && (
                                    <span className={cn(
                                      "px-2 py-0.5 text-[9px] rounded-full font-extrabold uppercase tracking-wide",
                                      item.duplicateType === 'database' 
                                        ? "bg-amber-100 text-amber-800 border border-amber-200" 
                                        : "bg-red-100 text-red-800 border border-red-200"
                                    )}>
                                      {item.duplicateType === 'database' ? 'Já no Banco' : 'Repetido na Planilha'}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => {
                                      const updatedList = previewItems.filter(p => p.id !== item.id);
                                      const reCheckedList = checkDuplicates(
                                        updatedList.map(({isDuplicate, duplicateType, key, ...rest}) => rest), 
                                        batches
                                      );
                                      setPreviewItems(reCheckedList);
                                    }}
                                    className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition-colors inline-block"
                                    title="Excluir esta linha para não importar"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Danger Zone */}
              <div className="pt-8 border-t border-[#e5e5e0]">
                <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertCircle className="text-red-600" size={20} />
                    <h5 className="font-bold text-red-900">Zona de Perigo</h5>
                  </div>
                  <p className="text-sm text-red-700 mb-6">
                    Se a importação falhou ou você deseja recomeçar do zero, você pode excluir todos os lotes cadastrados no sistema. Esta ação é irreversível.
                  </p>
                  
                  {showDeleteAllConfirm ? (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button 
                        onClick={handleDeleteAllBatches}
                        disabled={isDeletingAll}
                        className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isDeletingAll ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                        Sim, Excluir Tudo
                      </button>
                      <button 
                        onClick={() => setShowDeleteAllConfirm(false)}
                        disabled={isDeletingAll}
                        className="flex-1 bg-white text-[#5A5A40] border border-[#e5e5e0] py-3 rounded-xl font-bold hover:bg-[#f5f5f0]"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setShowDeleteAllConfirm(true)}
                      className="w-full bg-white text-red-600 border border-red-200 py-3 rounded-xl font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 size={18} />
                      Excluir Todos os Lotes
                    </button>
                  )}
                </div>
              </div>
            </div>

            {importStatus && (
              <div className={cn(
                "mt-6 p-4 rounded-xl flex items-center gap-3 animate-in zoom-in duration-200",
                importStatus.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : 
                importStatus.type === 'error' ? "bg-red-50 text-red-700 border border-red-100" : 
                "bg-blue-50 text-blue-700 border border-blue-100"
              )}>
                {importStatus.type === 'success' ? <CheckCircle2 size={20} /> : 
                 importStatus.type === 'error' ? <AlertCircle size={20} /> : 
                 <Loader2 className="animate-spin" size={20} />}
                <p className="text-sm font-medium">{importStatus.message}</p>
                {importStatus.type !== 'info' && (
                  <button onClick={() => setImportStatus(null)} className="ml-auto opacity-50 hover:opacity-100"><X size={16} /></button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : activeConfig === 'branding' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 text-[#1e293b]">
          
          {/* Card 1: Logotipo */}
          <div className="bg-[#f5f5f0] p-6 rounded-2xl border border-dashed border-[#5A5A40]/20 space-y-6">
            <div>
              <h4 className="font-display font-bold tracking-tight text-lg mb-1">Logotipo da Instituição</h4>
              <p className="text-sm text-[#5A5A40]/70">
                Faça o upload do logotipo da sua instituição (por exemplo, IPEM-PR). Esta imagem será exibida nos cabeçalhos de todos os modelos de notificação oficiais gerados pelo sistema.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div className="space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#5A5A40]/80 block">Upload do Logotipo</span>
                <div className="border border-gray-200 bg-white rounded-2xl p-6 shadow-sm flex flex-col gap-6">
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-[#5A5A40]/30 rounded-2xl p-8 bg-gray-50 hover:bg-gray-100/50 transition-all cursor-pointer relative">
                    <Upload size={32} className="text-[#5A5A40]/70 mb-3" />
                    <span className="text-xs font-bold text-gray-700">Arraste a imagem da logo para cá...</span>
                    <span className="text-[10px] text-gray-400 mt-1">ou clique para selecionar do computador</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) {
                          alert("A imagem selecionada é muito grande. Escolha uma imagem de até 2MB.");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          saveLogoUrl(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#5A5A40]/80 block">Visualização do Logotipo Ativo</span>
                <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center min-h-[220px]">
                  {logoUrl ? (
                    <div className="space-y-6 text-center w-full">
                      <div className="max-w-[240px] max-h-[100px] border border-gray-100 p-4 rounded-xl bg-gray-50 flex items-center justify-center mx-auto overflow-hidden">
                        <img src={logoUrl} alt="Logo Ativa" className="max-h-[80px] w-auto object-contain" referrerPolicy="no-referrer" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-gray-550 font-medium">Logotipo personalizado ativo com sucesso.</p>
                        <button
                          type="button"
                          onClick={() => saveLogoUrl('')}
                          className="bg-red-50 text-red-650 hover:bg-red-100/60 font-bold text-xs py-2 px-4 rounded-xl transition-all"
                        >
                          Remover Logotipo Personalizado
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="text-xs font-bold bg-gray-100 border border-gray-300 py-2 px-4 rounded-xl text-[#5A5A40] inline-block font-display">
                        IPEM-PR (Texto Padrão)
                      </div>
                      <p className="text-xs text-gray-400 max-w-[240px]">Nenhum logotipo personalizado carregado. O sistema usará o texto padrão "IPEM-PR".</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Assinaturas */}
          <div className="bg-[#f5f5f0] p-6 rounded-2xl border border-dashed border-[#5A5A40]/20 space-y-6">
            <div>
              <h4 className="font-display font-bold tracking-tight text-lg mb-1">Assinaturas Autorizadas</h4>
              <p className="text-sm text-[#5A5A40]/70">
                Cadastre e gerencie as assinaturas digitalizadas dos responsáveis e agentes que assinam as notificações oficiais geradas pelo sistema. Recomenda-se assinaturas com fundo transparente.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Form to Register Signature */}
              <div className="lg:col-span-5 bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-4">
                <h5 className="font-bold text-sm text-[#1e293b] border-b border-gray-100 pb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Upload size={16} className="text-[#5A5A40]" />
                    {editingSigId ? "Alterar Assinatura" : "Cadastrar Assinatura"}
                  </span>
                  {editingSigId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSigId(null);
                        setSigName("");
                        setSigRole("");
                        setSigImage("");
                      }}
                      className="text-[10px] text-[#5A5A40] hover:text-red-500 font-bold uppercase transition-colors"
                      title="Cancelar edição e voltar a cadastrar"
                    >
                      Cancelar
                    </button>
                  )}
                </h5>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!sigName.trim() || !sigRole.trim() || !sigImage) {
                      alert("Por favor, preencha o nome, cargo e selecione a imagem da assinatura.");
                      return;
                    }
                    const currentSigs = Array.isArray(signatures) ? signatures : [];
                    if (editingSigId) {
                      const updated = currentSigs.map((s: any) => 
                        s.id === editingSigId 
                          ? { ...s, name: sigName.trim(), role: sigRole.trim(), imageUrl: sigImage }
                          : s
                      );
                      saveSignatures(updated);
                      setEditingSigId(null);
                    } else {
                      const newSig = {
                        id: 'sig_' + Date.now(),
                        name: sigName.trim(),
                        role: sigRole.trim(),
                        imageUrl: sigImage
                      };
                      saveSignatures([...currentSigs, newSig]);
                    }
                    setSigName('');
                    setSigRole('');
                    setSigImage('');
                  }} 
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500 block">Nome do Signatário</label>
                    <input
                      type="text"
                      className="w-full text-xs font-semibold p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                      placeholder="Ex: João da Silva"
                      value={sigName}
                      onChange={(e) => setSigName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500 block">Cargo / Função</label>
                    <input
                      type="text"
                      className="w-full text-xs font-semibold p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                      placeholder="Ex: Agente Fiscal Metrológico"
                      value={sigRole}
                      onChange={(e) => setSigRole(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500 block">Imagem da Assinatura Digitalizada</label>
                    
                    {sigImage ? (
                      <div className="space-y-3">
                        <div className="border border-dashed border-gray-200 rounded-xl bg-gray-50 p-4 flex items-center justify-center max-h-[100px] overflow-hidden">
                          <img src={sigImage} alt="Assinatura Previsualização" className="max-h-[85px] w-auto object-contain" />
                        </div>
                        <button
                          type="button"
                          onClick={() => setSigImage('')}
                          className="text-[10px] font-bold text-red-650 hover:bg-red-50 py-1.5 px-3 rounded-lg transition-colors border border-red-250 w-full"
                        >
                          Trocar Imagem
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center border border-dashed border-[#5A5A40]/30 rounded-xl p-6 bg-gray-50 hover:bg-gray-150/40 cursor-pointer relative min-h-[110px] transition-colors">
                        <Upload size={20} className="text-[#5A5A40]/60 mb-1" />
                        <span className="text-[10px] font-bold text-gray-600">Fazer Upload de Assinatura</span>
                        <span className="text-[8px] text-gray-400 mt-0.5">PNG, JPG, BMP até 1MB</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 1 * 1024 * 1024) {
                              alert("A imagem selecionada é muito grande. Escolha uma imagem de até 1MB.");
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setSigImage(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#5A5A40] text-white hover:bg-[#4a4a30] font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 mt-2"
                  >
                    {editingSigId ? (
                      <>
                        <Check size={14} />
                        Salvar Alterações
                      </>
                    ) : (
                      <>
                        <Plus size={14} />
                        Cadastrar Assinatura
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* List of Registered Signatures */}
              <div className="lg:col-span-7 bg-white border border-gray-200 rounded-3xl p-6 shadow-sm min-h-[380px] flex flex-col">
                <h5 className="font-bold text-sm text-[#1e293b] border-b border-gray-100 pb-2 flex justify-between items-center">
                  <span>Assinaturas Cadastradas ({signatures?.length || 0})</span>
                </h5>

                <div className="flex-1 overflow-y-auto mt-4 max-h-[400px]">
                  {Array.isArray(signatures) && signatures.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {signatures.map((sig: any) => (
                        <div key={sig.id} className="border border-gray-150 rounded-2xl p-4 bg-gray-50 flex flex-col justify-between hover:shadow-sm transition-all relative group">
                          
                          {/* Action Buttons: Edit and Delete */}
                          <div className="absolute top-2 right-2 flex gap-1 bg-white/90 rounded-lg p-0.5 shadow-sm border border-gray-200 backdrop-blur-xs">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSigId(sig.id);
                                setSigName(sig.name);
                                setSigRole(sig.role);
                                setSigImage(sig.imageUrl || '');
                              }}
                              className="p-1 text-[#5A5A40] hover:bg-gray-150 rounded transition-colors"
                              title="Alterar / Substituir Assinatura"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Excluir a assinatura de ${sig.name}?`)) {
                                  saveSignatures((signatures || []).filter((s: any) => s.id !== sig.id));
                                  if (editingSigId === sig.id) {
                                    setEditingSigId(null);
                                    setSigName('');
                                    setSigRole('');
                                    setSigImage('');
                                  }
                                }
                              }}
                              className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                              title="Remover Assinatura"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          {/* Signature stamp representation */}
                          <div className="flex flex-col items-center text-center mt-3 mb-1">
                            <div className="h-[60px] flex items-center justify-center mb-1">
                              <img src={sig.imageUrl} alt={sig.name} className="max-h-[55px] max-w-[150px] object-contain" referrerPolicy="no-referrer" />
                            </div>
                            <div className="w-11/12 border-t border-gray-200 pt-1.5 mt-1">
                              <h6 className="font-bold text-[11px] text-gray-800 leading-tight">{sig.name}</h6>
                              <p className="text-[9px] text-gray-400 uppercase font-mono mt-0.5 tracking-tight">{sig.role}</p>
                            </div>
                          </div>

                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 flex flex-col items-center justify-center h-full text-gray-400">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-2">
                        <Upload size={20} />
                      </div>
                      <p className="text-xs font-semibold">Nenhuma assinatura cadastrada.</p>
                      <p className="text-[10px] text-gray-400 max-w-[200px] mt-1 mx-auto text-center">Cadastre uma assinatura no formulário ao lado para utilizá-la nos documentos oficiais.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      ) : (
        <>
          <div className="mb-6">
            <h3 className="font-display font-bold text-xl text-[#5A5A40] tracking-tight">
              {activeConfig === 'pacs' ? 'Gerenciar PACs' : 
               activeConfig === 'collabs' ? 'Gerenciar Colaboradores' : 
               activeConfig === 'status' ? 'Gerenciar Status' : 
               activeConfig === 'notification_types' ? 'Gerenciar Tipos de Notificações' :
               'Gerenciar Motivos de Não-Conformidade'}
            </h3>
            <p className="text-xs text-[#5A5A40]/60 mt-1">
              Adicione, edite ou exclua opções de preenchimento para as telas de recebimento de lotes.
            </p>
          </div>

          {activeConfig === 'non_conformities' ? (
            <div className="flex flex-col md:flex-row gap-3 mb-6 bg-[#f5f5f0]/40 p-4 rounded-2xl border border-[#e5e5e0]">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-bold uppercase text-[#5A5A40] block">Descrição do Motivo de Não-Conformidade</label>
                <input 
                  type="text" 
                  placeholder="Novo Motivo de Não-Conformidade..."
                  className="w-full p-2.5 bg-white border border-[#e5e5e0] rounded-xl text-xs focus:ring-2 focus:ring-[#5A5A40]/20 font-medium"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                />
              </div>
              <div className="w-full md:w-80 space-y-1">
                <label className="text-[10px] font-bold uppercase text-[#5A5A40] block">Enquadramento Vinculado</label>
                <select
                  className="w-full p-2.5 bg-white border border-[#e5e5e0] rounded-xl text-xs focus:ring-2 focus:ring-[#5A5A40]/20 font-semibold text-gray-700 h-[42px]"
                  value={selectedFramingId}
                  onChange={e => setSelectedFramingId(e.target.value)}
                >
                  <option value="">-- Sem Enquadramento --</option>
                  {sortedFramings.map((f: any) => (
                    <option key={f.id} value={f.id}>
                      N° {f.number} - {f.description.length > 50 ? f.description.substring(0, 50) + '...' : f.description}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button 
                  onClick={handleAdd}
                  className="w-full md:w-auto bg-[#5A5A40] text-white px-6 py-2.5 rounded-xl font-bold text-xs hover:bg-[#4a4a30] transition-colors h-[42px]"
                >
                  Adicionar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 mb-6">
              <input 
                type="text" 
                placeholder={
                  activeConfig === 'pacs' ? 'Novo PAC...' : 
                  activeConfig === 'collabs' ? 'Novo Colaborador...' : 
                  activeConfig === 'status' ? 'Novo Status...' : 
                  activeConfig === 'notification_types' ? 'Novo Tipo de Notificação...' :
                  'Novo Motivo de Não-Conformidade...'
                }
                className="flex-1 p-3 bg-[#f5f5f0] border-none rounded-xl focus:ring-2 focus:ring-[#5A5A40]/20 text-sm"
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
              />
              <button 
                onClick={handleAdd}
                className="bg-[#5A5A40] text-white px-6 rounded-xl font-bold hover:bg-[#4a4a30]"
              >
                Adicionar
              </button>
            </div>
          )}

          <div className="space-y-2">
            {items.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-[#f5f5f0] rounded-xl group">
                {editingId === item.id ? (
                  <div className="flex flex-col md:flex-row flex-1 gap-3 bg-white p-3 rounded-lg border border-[#e5e5e0]">
                    <div className="flex-1">
                      <label className="text-[9px] font-bold uppercase text-gray-400 block mb-1">Descrição</label>
                      <input 
                        type="text"
                        className="w-full px-3 py-1.5 bg-white border border-[#e5e5e0] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 font-medium"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        autoFocus
                      />
                    </div>
                    {activeConfig === 'non_conformities' && (
                      <div className="w-full md:w-60">
                        <label className="text-[9px] font-bold uppercase text-gray-400 block mb-1">Enquadramento Vinculado</label>
                        <select
                          className="w-full px-3 py-1.5 bg-white border border-[#e5e5e0] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 font-semibold text-gray-700"
                          value={editingConfigFramingId}
                          onChange={e => setEditingConfigFramingId(e.target.value)}
                        >
                          <option value="">-- Sem Enquadramento --</option>
                          {sortedFramings.map((f: any) => (
                            <option key={f.id} value={f.id}>
                              N° {f.number} - {f.description.length > 30 ? f.description.substring(0, 30) + '...' : f.description}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex gap-2 items-end justify-end">
                      <button 
                        onClick={handleSaveEdit}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                        title="Salvar"
                      >
                        <Check size={18} />
                      </button>
                      <button 
                        onClick={() => {
                          setEditingId(null);
                          setEditingConfigFramingId('');
                        }}
                        className="p-1.5 text-red-650 hover:bg-red-50 rounded-lg"
                        title="Cancelar"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 pr-4">
                      <span className="font-semibold text-gray-800 text-sm block">{item.name}</span>
                      {activeConfig === 'non_conformities' && (
                        <div className="mt-1 text-xs text-[#5A5A40]/70 flex flex-wrap gap-2 items-center">
                          {item.framingNumber ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#5A5A40]/10 text-[#5A5A40] font-mono text-[10px] font-bold">
                              Enquadramento: N° {item.framingNumber} - {item.framingDescription}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">-- Nenhum enquadramento vinculado --</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {activeConfig === 'notification_types' && (
                        <button 
                          onClick={() => handleCopyNotificationType(item)}
                          className="p-2 text-[#5A5A40] hover:bg-white rounded-lg transition-all mr-1"
                          title="Copiar Modelo de Notificação"
                        >
                          <Copy size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleEdit(item)}
                        className="p-2 text-[#5A5A40] hover:bg-white rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-red-500 hover:bg-white rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {activeConfig === 'non_conformities' && (
            <div className="mt-12 pt-8 border-t border-[#e5e5e0] space-y-6">
              <div>
                <h4 className="font-display font-bold text-lg text-[#5A5A40] tracking-tight">
                  Gerenciar enquadramentos
                </h4>
                <p className="text-xs text-[#5A5A40]/60 mt-0.5">
                  Associe leis, normas ou portarias de enquadramento legal aos motivos de não-conformidade.
                </p>
              </div>

              {/* Form to add framing */}
              <div className="bg-[#f5f5f0]/40 p-4 rounded-2xl border border-[#e5e5e0] flex flex-col md:flex-row gap-3">
                <div className="w-full md:w-1/3 space-y-1 font-sans">
                  <label className="text-[10px] font-bold uppercase text-[#5A5A40] block">N° do Enquadramento</label>
                  <input
                    type="text"
                    placeholder="Ex: Art. 10..."
                    className="w-full p-2.5 bg-white border border-[#e5e5e0] rounded-xl text-xs focus:ring-2 focus:ring-[#5A5A40]/20 font-medium"
                    value={newFramingNumber}
                    onChange={(e) => setNewFramingNumber(e.target.value)}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-bold uppercase text-[#5A5A40] block">Descrição do Enquadramento</label>
                  <input
                    type="text"
                    placeholder="Ex: Inobservância do padrão regulamentar..."
                    className="w-full p-2.5 bg-white border border-[#e5e5e0] rounded-xl text-xs focus:ring-2 focus:ring-[#5A5A40]/20 font-medium"
                    value={newFramingDescription}
                    onChange={(e) => setNewFramingDescription(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAddFraming}
                    className="w-full md:w-auto bg-[#5A5A40] text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-[#4a4a30] transition-colors h-[42px]"
                  >
                    Salvar Enquadramento
                  </button>
                </div>
              </div>

              {/* Search query */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="🔍 Buscar enquadramento por número..."
                  className="w-full md:w-80 p-2 py-1.5 bg-[#f5f5f0] border border-transparent rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/10"
                  value={framingSearch}
                  onChange={(e) => setFramingSearch(e.target.value)}
                />
                {framingSearch && (
                  <button
                    onClick={() => setFramingSearch('')}
                    className="text-xs text-red-500 hover:underline font-bold"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* Framings list */}
              <div className="space-y-2">
                {sortedFramings.filter((f: any) => {
                  if (!framingSearch.trim()) return true;
                  const query = framingSearch.toLowerCase().trim();
                  return (f.number || '').toLowerCase().includes(query) || (f.description || '').toLowerCase().includes(query);
                }).length > 0 ? (
                  sortedFramings.filter((f: any) => {
                    if (!framingSearch.trim()) return true;
                    const query = framingSearch.toLowerCase().trim();
                    return (f.number || '').toLowerCase().includes(query) || (f.description || '').toLowerCase().includes(query);
                  }).map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between p-3.5 bg-[#f5f5f0]/50 rounded-xl border border-transparent hover:border-[#e5e5e0] transition-all group">
                      {editingFramingId === f.id ? (
                        <div className="flex flex-col md:flex-row flex-1 gap-3 bg-white p-3 rounded-lg border border-[#e5e5e0]">
                          <div className="w-full md:w-1/3">
                            <label className="text-[9px] font-bold uppercase text-gray-400 block mb-1">N°</label>
                            <input
                              type="text"
                              className="w-full px-3 py-1.5 bg-white border border-[#e5e5e0] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 font-semibold"
                              value={editingFramingNumber}
                              onChange={(e) => setEditingFramingNumber(e.target.value)}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[9px] font-bold uppercase text-gray-400 block mb-1">Descrição</label>
                            <input
                              type="text"
                              className="w-full px-3 py-1.5 bg-white border border-[#e5e5e0] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 font-medium"
                              value={editingFramingDescription}
                              onChange={(e) => setEditingFramingDescription(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-2 items-end justify-end">
                            <button
                              onClick={handleSaveEditFraming}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                              title="Salvar"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => {
                                setEditingFramingId(null);
                                setEditingFramingNumber('');
                                setEditingFramingDescription('');
                              }}
                              className="p-1.5 text-red-650 hover:bg-red-50 rounded-lg"
                              title="Cancelar"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#5A5A40]/10 text-[#5A5A40] font-mono text-[10px] font-bold">
                                N° {f.number}
                              </span>
                              <span className="text-xs text-gray-800 font-medium">{f.description}</span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleStartEditFraming(f)}
                              className="p-2 text-[#5A5A40] hover:bg-white rounded-lg transition-colors"
                              title="Editar Enquadramento"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Deseja realmente excluir o enquadramento N° ${f.number}? Motivos de não-conformidade vinculados a ele perderão o vínculo.`)) {
                                  handleDeleteFraming(f.id);
                                }
                              }}
                              className="p-2 text-red-500 hover:bg-white rounded-lg transition-colors"
                              title="Excluir Enquadramento"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 italic bg-gray-50 p-4 rounded-xl border border-dashed border-gray-150 text-center">Nenhum enquadramento correspondente aos termos de busca.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}

  {activeConfig === 'notification_types' && (
    <div className="mt-10 pt-10 border-t border-gray-200">
      <NotificationTemplatesManager
        notificationTypes={notificationTypes}
        setNotificationTypes={setNotificationTypes}
        isLocalMode={isLocalMode}
        handleFirestoreError={handleFirestoreError}
        batches={batches}
        pacs={pacs}
        nonConformityRecords={nonConformityRecords}
        nonConformitiesConfigs={nonConformitiesConfigs}
        logoUrl={logoUrl}
        signatures={signatures}
      />
    </div>
  )}
</div>
);
}

function StatsPanel({ batches, collaborators, pacs }: { batches: any[]; collaborators: any[]; pacs: any[] }) {
  // Default filter dates: last 30 days
  const defaultStatsStart = useMemo(() => format(addDays(new Date(), -30), 'yyyy-MM-dd'), []);
  const defaultStatsEnd = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const [selectedCollab, setSelectedCollab] = useState<string>('');
  const [filterPreset, setFilterPreset] = useState<'30days' | 'period' | 'year' | 'month'>('30days');
  const [statsStartDate, setStatsStartDate] = useState<string>(defaultStatsStart);
  const [statsEndDate, setStatsEndDate] = useState<string>(defaultStatsEnd);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); // 0-indexed

  // Synchronize start and end dates based on filter preset
  useEffect(() => {
    if (filterPreset === '30days') {
      setStatsStartDate(format(addDays(new Date(), -30), 'yyyy-MM-dd'));
      setStatsEndDate(format(new Date(), 'yyyy-MM-dd'));
    } else if (filterPreset === 'year') {
      setStatsStartDate(`${selectedYear}-01-01`);
      setStatsEndDate(`${selectedYear}-12-31`);
    } else if (filterPreset === 'month') {
      const firstDay = format(new Date(selectedYear, selectedMonth, 1), 'yyyy-MM-dd');
      const lastDay = format(new Date(selectedYear, selectedMonth + 1, 0), 'yyyy-MM-dd');
      setStatsStartDate(firstDay);
      setStatsEndDate(lastDay);
    }
  }, [filterPreset, selectedYear, selectedMonth]);

  // Compute unique list of collaborators with actual production in the filtered period
  const collabsWithProductionInPeriod = useMemo(() => {
    const list: string[] = [];
    batches.forEach(b => {
      // Check date range
      let inRange = true;
      if (statsStartDate) {
        const start = startOfDay(parseLocalDate(statsStartDate));
        if (b.periodoInicial.toDate() < start) inRange = false;
      }
      if (statsEndDate) {
        const end = startOfDay(parseLocalDate(statsEndDate));
        if (startOfDay(b.periodoInicial.toDate()) > end) inRange = false;
      }

      if (inRange) {
        if (b.lidoPor && b.lidoPor.trim() !== '') {
          list.push(b.lidoPor.trim());
        }
        if (b.conferidoPor && b.conferidoPor.trim() !== '') {
          list.push(b.conferidoPor.trim());
        }
      }
    });
    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
  }, [batches, statsStartDate, statsEndDate]);

  // Filter batches based on inputs
  const filtered = useMemo(() => {
    return batches.filter(b => {
      // Name filter: either lidoPor or conferidoPor contains the selectedCollab
      if (selectedCollab) {
        const matchesCollab = (b.lidoPor === selectedCollab) || (b.conferidoPor === selectedCollab);
        if (!matchesCollab) return false;
      }

      // Period filters based on periodoInicial
      if (statsStartDate) {
        const start = startOfDay(parseLocalDate(statsStartDate));
        if (b.periodoInicial.toDate() < start) return false;
      }
      if (statsEndDate) {
        const end = startOfDay(parseLocalDate(statsEndDate));
        if (startOfDay(b.periodoInicial.toDate()) > end) return false;
      }

      return true;
    });
  }, [batches, selectedCollab, statsStartDate, statsEndDate]);

  // Compute stats on the filtered batches
  const computedStats = useMemo(() => {
    const productivity: Record<string, { lido: number, informado: number }> = {};
    
    let onTimeCount = 0;
    let lateCount = 0;
    let totalEnsaiosFinished = 0;
    let totalEnsaiosOpen = 0;

    filtered.forEach(b => {
      if (!b.conferidoPor) {
        totalEnsaiosOpen += b.numEnsaios;
      }

      // Track reading productivity
      if (b.lidoPor) {
        if (!selectedCollab || b.lidoPor === selectedCollab) {
          if (!productivity[b.lidoPor]) productivity[b.lidoPor] = { lido: 0, informado: 0 };
          productivity[b.lidoPor].lido += b.numEnsaios;
        }
      }

      // Track informing productivity
      if (b.conferidoPor) {
        if (!selectedCollab || b.conferidoPor === selectedCollab) {
          if (!productivity[b.conferidoPor]) productivity[b.conferidoPor] = { lido: 0, informado: 0 };
          productivity[b.conferidoPor].informado += b.numEnsaios;
        }
        
        // Quality stats counts (onTime vs late)
        if (!selectedCollab || b.conferidoPor === selectedCollab) {
          totalEnsaiosFinished += b.numEnsaios;
          const deadline = addDays(b.periodoInicial.toDate(), 30);
          if (isAfter(b.conferidoEm!.toDate(), deadline)) {
            lateCount++;
          } else {
            onTimeCount++;
          }
        }
      }
    });

    const productivityList = Object.entries(productivity).sort((a, b) => {
      return a[0].localeCompare(b[0]);
    });

    const totalFinished = onTimeCount + lateCount;

    return {
      productivity: productivityList,
      onTimeCount,
      lateCount,
      totalFinished,
      totalEnsaiosFinished,
      totalEnsaiosOpen
    };
  }, [filtered, selectedCollab]);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Filtros da Tela Estatísticas */}
      <div className="bg-white p-6 rounded-[32px] border border-[#e5e5e0]">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#f5f5f0] pb-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#5A5A40]">Filtros de Estatística</h3>
              <p className="text-xs text-[#5A5A40]/60">Selecione o período de análise de produtividade e qualidade.</p>
            </div>
            <div className="flex flex-wrap gap-1 bg-[#f5f5f0] p-1 rounded-xl">
              <button
                onClick={() => setFilterPreset('30days')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  filterPreset === '30days' ? "bg-white text-[#5A5A40] shadow-sm" : "text-[#5A5A40]/60 hover:text-[#5A5A40]"
                )}
              >
                Últimos 30 Dias
              </button>
              <button
                onClick={() => setFilterPreset('period')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  filterPreset === 'period' ? "bg-white text-[#5A5A40] shadow-sm" : "text-[#5A5A40]/60 hover:text-[#5A5A40]"
                )}
              >
                Por Período
              </button>
              <button
                onClick={() => setFilterPreset('year')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  filterPreset === 'year' ? "bg-white text-[#5A5A40] shadow-sm" : "text-[#5A5A40]/60 hover:text-[#5A5A40]"
                )}
              >
                Por Ano
              </button>
              <button
                onClick={() => setFilterPreset('month')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  filterPreset === 'month' ? "bg-white text-[#5A5A40] shadow-sm" : "text-[#5A5A40]/60 hover:text-[#5A5A40]"
                )}
              >
                Por Mês
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-end justify-between">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 w-full">
              {/* Filtro por Colaborador */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-[#5A5A40]">Filtrar por Colaborador</label>
                <select
                  className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:outline-none font-medium text-gray-700"
                  value={selectedCollab}
                  onChange={(e) => setSelectedCollab(e.target.value)}
                >
                  <option value="">Todos os Colaboradores</option>
                  {collabsWithProductionInPeriod.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  {collabsWithProductionInPeriod.length === 0 && (
                    <option disabled value="">Nenhum colaborador com produção</option>
                  )}
                </select>
              </div>

              {/* Dynamic controls based on filterPreset */}
              {filterPreset === 'period' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-[#5A5A40]">Período Inicial</label>
                    <input
                      type="date"
                      className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:outline-none font-medium text-gray-700"
                      value={statsStartDate}
                      onChange={(e) => setStatsStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-[#5A5A40]">Período Final</label>
                    <input
                      type="date"
                      className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:outline-none font-medium text-gray-700"
                      value={statsEndDate}
                      onChange={(e) => setStatsEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              {filterPreset === '30days' && (
                <div className="col-span-2 space-y-2">
                  <label className="text-xs font-bold uppercase text-[#5A5A40]">Período Selecionado (Automático)</label>
                  <div className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-[#5A5A40]/80 font-medium">
                    De <span className="font-bold underline">{format(parseLocalDate(statsStartDate), 'dd/MM/yyyy')}</span> até <span className="font-bold underline">{format(parseLocalDate(statsEndDate), 'dd/MM/yyyy')}</span> (Últimos 30 dias)
                  </div>
                </div>
              )}

              {filterPreset === 'year' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-[#5A5A40]">Selecionar Ano</label>
                    <select
                      className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:outline-none font-medium text-gray-700"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                    >
                      {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-[#5A5A40]">Período do Ano</label>
                    <div className="w-full h-[48px] flex items-center px-4 bg-gray-50 border border-gray-100 rounded-xl text-xs text-[#5A5A40]/80 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                      {format(parseLocalDate(statsStartDate), 'dd/MM/yyyy')} - {format(parseLocalDate(statsEndDate), 'dd/MM/yyyy')}
                    </div>
                  </div>
                </>
              )}

              {filterPreset === 'month' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-[#5A5A40]">Selecionar Mês</label>
                    <select
                      className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:outline-none font-medium text-gray-700"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    >
                      {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, idx) => (
                        <option key={idx} value={idx}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-[#5A5A40]">Selecionar Ano</label>
                    <select
                      className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:outline-none font-medium text-gray-700"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                    >
                      {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Clear button if customized */}
            {(selectedCollab || filterPreset !== '30days' || selectedYear !== currentYear || selectedMonth !== new Date().getMonth()) && (
              <button
                onClick={() => {
                  setSelectedCollab('');
                  setFilterPreset('30days');
                  setSelectedYear(currentYear);
                  setSelectedMonth(new Date().getMonth());
                }}
                className="w-full lg:w-auto px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all h-[44px] shrink-0"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Productivity by Collaborator x Activity */}
        <div className="lg:col-span-2 bg-white rounded-[32px] p-8 border border-[#e5e5e0]">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="text-[#5A5A40]" size={24} />
            <h3 className="text-xl font-display font-bold tracking-tight">Produtividade por Atividade</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase font-bold text-[#5A5A40] opacity-50 border-b border-[#e5e5e0]">
                  <th className="pb-4">Colaborador</th>
                  <th className="pb-4 text-center">Ensaios Lidos</th>
                  <th className="pb-4 text-center">Ensaios Informados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5f5f0]">
                {computedStats.productivity.map(([name, data]: [string, any]) => (
                  <tr key={name} className="group hover:bg-[#f5f5f0]/50 transition-colors">
                    <td className="py-4 font-medium">{name}</td>
                    <td className="py-4 text-center">
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold">{data.lido}</span>
                    </td>
                    <td className="py-4 text-center">
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">{data.informado}</span>
                    </td>
                  </tr>
                ))}
                {computedStats.productivity.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-[#5A5A40] opacity-60 italic">
                      Nenhuma atividade registrada ainda para este período / filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resolution Quality */}
        <div className="bg-white rounded-[32px] p-8 border border-[#e5e5e0]">
          <div className="flex items-center gap-3 mb-6">
            <History className="text-[#5A5A40]" size={24} />
            <h3 className="text-xl font-display font-bold tracking-tight">Qualidade de Entrega</h3>
          </div>
          <div className="flex flex-col items-center justify-center h-48">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full" viewBox="0 0 36 36">
                <path
                  className="text-red-100 stroke-current"
                  strokeWidth="3"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500 stroke-current"
                  strokeWidth="3"
                  strokeDasharray={`${computedStats.totalFinished > 0 ? (computedStats.onTimeCount / computedStats.totalFinished) * 100 : 0}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-2xl font-bold">
                  {computedStats.totalFinished > 0 ? Math.round((computedStats.onTimeCount / computedStats.totalFinished) * 100) : 0}%
                </span>
                <span className="text-[10px] uppercase font-bold opacity-50">No Prazo</span>
              </div>
            </div>
            <div className="mt-6 flex gap-8 text-sm font-medium">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                <span>No Prazo: {computedStats.onTimeCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-400 rounded-full" />
                <span>Atrasados: {computedStats.lateCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seção de Produtividade por PAC */}
      <PacProductivitySection 
        batches={batches} 
        pacs={pacs} 
        statsStartDate={statsStartDate} 
        statsEndDate={statsEndDate} 
        defaultStatsStart={defaultStatsStart} 
        defaultStatsEnd={defaultStatsEnd} 
      />
    </div>
  );
}

interface PacProductivitySectionProps {
  batches: any[];
  pacs: any[];
  statsStartDate: string;
  statsEndDate: string;
  defaultStatsStart: string;
  defaultStatsEnd: string;
}

function PacProductivitySection({
  batches,
  pacs,
  statsStartDate,
  statsEndDate,
  defaultStatsStart,
  defaultStatsEnd
}: PacProductivitySectionProps) {
  const [selectedPacFilter, setSelectedPacFilter] = useState<string>('all');
  const [pacSortOrder, setPacSortOrder] = useState<'delivered_desc' | 'alphabetical'>('delivered_desc');

  // Find all delivered batches in the stats period (using RECEBIDO EM)
  const pacStats = useMemo(() => {
    return batches.filter(b => {
      const isFinished = b.conferidoPor && b.conferidoPor.trim() !== '';
      if (!isFinished) return false;

      const dateObj = b.recebidoEm ? b.recebidoEm.toDate() : b.periodoInicial?.toDate();
      if (!dateObj) return false;

      if (statsStartDate) {
        const start = startOfDay(parseLocalDate(statsStartDate));
        if (dateObj < start) return false;
      }
      if (statsEndDate) {
        const end = startOfDay(parseLocalDate(statsEndDate));
        if (startOfDay(dateObj) > end) return false;
      }
      return true;
    });
  }, [batches, statsStartDate, statsEndDate]);

  // Unique list of all PAC names (from config pacs AND batches to be absolutely exhaustive)
  const allPacNames = useMemo(() => {
    const fromConfig = pacs.map(p => p.name);
    const fromBatches = batches.map(b => b.pac);
    return Array.from(new Set([...fromConfig, ...fromBatches])).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [pacs, batches]);

  // Grouped data when 'all' is selected
  const pacGroupedData = useMemo(() => {
    const list = allPacNames.map(pacName => {
      const pacBatches = pacStats.filter(b => b.pac === pacName);
      const totalEnsaios = pacBatches.reduce((acc, b) => acc + b.numEnsaios, 0);
      return {
        pac: pacName,
        totalEnsaios
      };
    });

    // Sort list based on pacSortOrder
    if (pacSortOrder === 'delivered_desc') {
      list.sort((a, b) => b.totalEnsaios - a.totalEnsaios || a.pac.localeCompare(b.pac));
    } else {
      list.sort((a, b) => a.pac.localeCompare(b.pac));
    }

    return list;
  }, [allPacNames, pacStats, pacSortOrder]);

  // Determine scale/grouping type of selected dates
  const rangeInDays = useMemo(() => {
    const start = parseLocalDate(statsStartDate || defaultStatsStart);
    const end = parseLocalDate(statsEndDate || defaultStatsEnd);
    return differenceInDays(end, start);
  }, [statsStartDate, statsEndDate, defaultStatsStart, defaultStatsEnd]);

  const groupingType = useMemo<'day' | 'month' | 'year'>(() => {
    if (rangeInDays <= 31) {
      return 'day';
    } else if (rangeInDays <= 365) {
      return 'month';
    } else {
      return 'year';
    }
  }, [rangeInDays]);

  // Helper inside component to get formatted dates
  const getGroupKeyAndLabel = (date: Date, type: 'day' | 'month' | 'year') => {
    if (type === 'day') {
      return {
        key: format(date, 'yyyy-MM-dd'),
        label: format(date, 'dd/MM/yyyy', { locale: ptBR })
      };
    } else if (type === 'month') {
      return {
        key: format(date, 'yyyy-MM'),
        label: format(date, "MMMM 'de' yyyy", { locale: ptBR })
      };
    } else {
      return {
        key: format(date, 'yyyy'),
        label: format(date, 'yyyy')
      };
    }
  };

  // Grouped data when a specific PAC is selected
  const specificPacData = useMemo(() => {
    if (selectedPacFilter === 'all') return [];

    const pacBatchesInPeriod = pacStats.filter(b => b.pac === selectedPacFilter);
    
    // Group them
    const groups: Record<string, { key: string, label: string, totalEnsaios: number, dateObj: Date }> = {};
    
    pacBatchesInPeriod.forEach(b => {
      const date = b.recebidoEm ? b.recebidoEm.toDate() : b.periodoInicial?.toDate();
      if (!date) return;
      const { key, label } = getGroupKeyAndLabel(date, groupingType);
      if (!groups[key]) {
        groups[key] = {
          key,
          label,
          totalEnsaios: 0,
          dateObj: date
        };
      }
      groups[key].totalEnsaios += b.numEnsaios;
    });

    // Sort chronologically
    return Object.values(groups).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [pacStats, selectedPacFilter, groupingType]);

  // Grouped breakdown of all PACs by month/year (when selectedPacFilter is 'all' and groupingType !== 'day')
  const allPacsBreakdownData = useMemo(() => {
    if (selectedPacFilter !== 'all' || groupingType === 'day') return [];

    const groups: Record<string, { key: string; label: string; pac: string; totalEnsaios: number; dateObj: Date }> = {};

    pacStats.forEach(b => {
      const date = b.recebidoEm ? b.recebidoEm.toDate() : b.periodoInicial?.toDate();
      if (!date) return;
      const { key, label } = getGroupKeyAndLabel(date, groupingType);
      const compositeKey = `${key}_${b.pac}`;

      if (!groups[compositeKey]) {
        groups[compositeKey] = {
          key,
          label,
          pac: b.pac || 'Sem PAC',
          totalEnsaios: 0,
          dateObj: date
        };
      }
      groups[compositeKey].totalEnsaios += b.numEnsaios;
    });

    // Sort chronologically then by PAC
    return Object.values(groups).sort((a, b) => {
      const timeDiff = a.dateObj.getTime() - b.dateObj.getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.pac.localeCompare(b.pac);
    });
  }, [pacStats, selectedPacFilter, groupingType]);

  // Render chronological breakdown table for all PACs
  const renderAllPacsBreakdownSection = () => {
    if (groupingType === 'day') {
      return (
        <div className="flex flex-col items-center justify-center p-8 h-64 bg-gray-50 border border-dashed border-[#e5e5e0] rounded-2xl text-center leading-normal">
          <BarChart3 size={32} className="text-[#5A5A40]/30 mb-2" />
          <h5 className="text-xs font-bold text-[#5A5A40] opacity-80">Tabela de Evolução</h5>
          <span className="text-[11px] text-[#5A5A40]/60 max-w-xs mt-1">
            Selecione um período maior que 31 dias (mais de um mês ou ano) para carregar a tabela detalhada de evolução cronológica por período.
          </span>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto max-h-[280px] overflow-y-auto mt-4 pr-1 scrollbar-thin">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] uppercase font-bold text-[#5A5A40] opacity-50 border-b border-[#e5e5e0]">
              <th className="pb-3">Período ({groupingType === 'month' ? 'Mês' : 'Ano'})</th>
              <th className="pb-3">PAC</th>
              <th className="pb-3 text-center">Ensaios Entregues</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f5f5f0]">
            {allPacsBreakdownData.map((row) => (
              <tr key={`${row.key}_${row.pac}`} className="group hover:bg-[#f5f5f0]/50 transition-colors">
                <td className="py-3 font-medium text-xs capitalize">{row.label}</td>
                <td className="py-3 font-medium text-xs">{row.pac}</td>
                <td className="py-3 text-center">
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">
                    {row.totalEnsaios}
                  </span>
                </td>
              </tr>
            ))}
            {allPacsBreakdownData.length === 0 && (
              <tr>
                <td colSpan={3} className="py-8 text-center text-xs text-[#5A5A40] opacity-60 italic">
                  Nenhuma entrega registrada para detalhar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSpecificPacChart = () => {
    const chartData = specificPacData;
    if (chartData.length <= 1) {
      return (
        <div className="flex flex-col items-center justify-center p-8 h-64 bg-gray-50 border border-dashed border-[#e5e5e0] rounded-2xl text-xs text-[#5A5A40]/60 text-center leading-normal">
          <Clock size={32} className="text-[#5A5A40]/30 mb-2" />
          <span>Dados insuficientes para exibição do gráfico evolutivo.</span>
          <span className="opacity-75 mt-1">O gráfico de evolução requer entregas registradas em pelo menos 2 períodos diferentes (ex: meses ou dias distintos).</span>
        </div>
      );
    }

    return (
      <div className="h-72 w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
            <defs>
              <linearGradient id="colorEnsaios" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E0" />
            <XAxis 
              dataKey="label" 
              tick={{ fill: '#5A5A40', fontSize: 10 }}
              axisLine={{ stroke: '#E5E5E0' }}
              tickLine={{ stroke: '#E5E5E0' }}
            />
            <YAxis tick={{ fill: '#5A5A40', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E5E5E0', fontSize: '12px' }}
              labelStyle={{ fontWeight: 'bold', color: '#1a1a1a' }}
            />
            <Area type="monotone" dataKey="totalEnsaios" name="Ensaios Entregues" stroke="#10b981" fillOpacity={1} fill="url(#colorEnsaios)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-[32px] p-8 border border-[#e5e5e0] mt-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#f5f5f0] pb-6 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <BarChart3 className="text-[#5A5A40]" size={24} />
            <h3 className="text-xl font-display font-bold tracking-tight">Produtividade por PAC</h3>
          </div>
          <p className="text-xs text-[#5A5A40]/60 mt-1">
            Total de ensaios entregues (finalizados/informados) agrupados por PAC no período selecionado.
          </p>
        </div>

        {/* Filters specific to PAC Productivity */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-[#5A5A40] opacity-60 block">Filtrar PAC</label>
            <select
              className="px-3 py-2 bg-[#f5f5f0] border-none rounded-xl text-xs focus:ring-2 focus:ring-[#5A5A40]/20 focus:outline-none font-bold text-[#5A5A40]"
              value={selectedPacFilter}
              onChange={(e) => setSelectedPacFilter(e.target.value)}
            >
              <option value="all">Todos os PACs</option>
              {allPacNames.map(pac => (
                <option key={pac} value={pac}>{pac}</option>
              ))}
            </select>
          </div>

          {selectedPacFilter === 'all' && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-[#5A5A40] opacity-60 block">Ordenação</label>
              <select
                className="px-3 py-2 bg-[#f5f5f0] border-none rounded-xl text-xs focus:ring-2 focus:ring-[#5A5A40]/20 focus:outline-none font-bold text-[#5A5A40]"
                value={pacSortOrder}
                onChange={(e) => setPacSortOrder(e.target.value as any)}
              >
                <option value="delivered_desc">Ensaios Entregues (Maior para Menor)</option>
                <option value="alphabetical">Ordem Alfabética</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Table Column */}
        <div className="overflow-x-auto">
          {selectedPacFilter === 'all' ? (
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase font-bold text-[#5A5A40] opacity-50 border-b border-[#e5e5e0]">
                  <th className="pb-4">PAC</th>
                  <th className="pb-4 text-center">Ensaios Entregues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5f5f0]">
                {pacGroupedData.map((row) => (
                  <tr key={row.pac} className="group hover:bg-[#f5f5f0]/50 transition-colors">
                    <td className="py-4 font-medium text-sm">{row.pac}</td>
                    <td className="py-4 text-center">
                      <span className="px-2 py-1 bg-[#5A5A40]/10 text-[#5A5A40] rounded-lg text-xs font-bold">
                        {row.totalEnsaios}
                      </span>
                    </td>
                  </tr>
                ))}
                {pacGroupedData.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-8 text-center text-xs text-[#5A5A40] opacity-60 italic">
                      Nenhum PAC cadastrado ou com entregas no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase font-bold text-[#5A5A40] opacity-50 border-b border-[#e5e5e0]">
                  <th className="pb-4">Período ({groupingType === 'day' ? 'Dia' : groupingType === 'month' ? 'Mês' : 'Ano'})</th>
                  <th className="pb-4 text-center">Ensaios Entregues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5f5f0]">
                {specificPacData.map((row) => (
                  <tr key={row.key} className="group hover:bg-[#f5f5f0]/50 transition-colors">
                    <td className="py-4 font-medium text-sm capitalize">{row.label}</td>
                    <td className="py-4 text-center">
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">
                        {row.totalEnsaios}
                      </span>
                    </td>
                  </tr>
                ))}
                {specificPacData.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-8 text-center text-xs text-[#5A5A40] opacity-60 italic">
                      Nenhuma entrega de ensaio registrada para {selectedPacFilter} no período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Chart Column */}
        <div className="flex flex-col justify-center">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A5A40] opacity-75 mb-2">
            {selectedPacFilter === 'all' 
              ? (groupingType !== 'day' ? 'Detalhamento de Entregas por Período e PAC' : 'Infomativo') 
              : `Gráfico Evolutivo: ${selectedPacFilter}`}
          </h4>
          {selectedPacFilter === 'all' ? renderAllPacsBreakdownSection() : renderSpecificPacChart()}
        </div>
      </div>
    </div>
  );
}
