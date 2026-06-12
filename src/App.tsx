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
  doc, 
  query, 
  orderBy, 
  Timestamp,
  getDocFromServer,
  deleteDoc,
  getDocs,
  writeBatch
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
  ChevronDown
} from 'lucide-react';
import { format, addDays, differenceInDays, isAfter, isBefore, startOfDay, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { read, utils } from 'xlsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('open'); // Changed default to 'open'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'config' | 'stats'>('dashboard');
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
      }
      // Ensure LUIZ CARLOS is in initialCollabs and rename/deduplicate LUIZ
      let hasCollabChanges = false;
      initialCollabs = initialCollabs.map((c: any) => {
        if (c.name.trim().toUpperCase() === 'LUIZ') {
          hasCollabChanges = true;
          return { ...c, name: 'LUIZ CARLOS' };
        }
        return c;
      });

      const hasLuizLocal = initialCollabs.some((c: any) => c.name.toUpperCase().trim() === 'LUIZ CARLOS');
      if (!hasLuizLocal) {
        initialCollabs.push({ id: 'c-luiz', name: 'LUIZ CARLOS' });
        hasCollabChanges = true;
      }

      // Deduplicate collaborators to prevent duplicates of 'LUIZ CARLOS'
      const seenNames = new Set<string>();
      const beforeCount = initialCollabs.length;
      initialCollabs = initialCollabs.filter((c: any) => {
        const norm = c.name.toUpperCase().trim();
        if (seenNames.has(norm)) {
          return false;
        }
        seenNames.add(norm);
        return true;
      });
      if (initialCollabs.length !== beforeCount) {
        hasCollabChanges = true;
      }

      if (hasCollabChanges) {
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
        let hasChanges = false;
        const sanitizedRaw = raw.map((b: any) => {
          let updatedRecPor = b.recebidoPor;
          if (b.recebidoPor && b.recebidoPor.toUpperCase().trim() === 'LUIZ') {
            updatedRecPor = 'LUIZ CARLOS';
            hasChanges = true;
          }
          const statusUpper = (b.status || '').toUpperCase().trim();
          const isTargetStatus = statusUpper === 'FINALIZADO' || statusUpper === 'ABERTO';
          const isRecebidoPorBlank = !updatedRecPor || !updatedRecPor.trim();
          if (isTargetStatus && isRecebidoPorBlank) {
            updatedRecPor = 'LUIZ CARLOS';
            hasChanges = true;
          }
          if (updatedRecPor !== b.recebidoPor) {
            return { ...b, recebidoPor: updatedRecPor };
          }
          return b;
        });

        if (hasChanges) {
          localStorage.setItem('lotes_batches', JSON.stringify(sanitizedRaw));
        }

        initialBatches = sanitizedRaw.map((b: any) => ({
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

      setPacs(initialPacs.sort((a, b) => a.name.localeCompare(b.name)));
      setCollaborators(initialCollabs.sort((a, b) => a.name.localeCompare(b.name)));
      setStatuses(initialStatuses.sort((a, b) => a.name.localeCompare(b.name)));
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
      (snapshot) => {
        const docsMapped = snapshot.docs.map(d => {
          const data = d.data();
          let finalRecPor = (data.recebidoPor || '').trim();
          if (finalRecPor.toUpperCase() === 'LUIZ') {
            finalRecPor = 'LUIZ CARLOS';
          }
          const statusUpper = (data.status || '').toUpperCase().trim();
          const isTargetStatus = statusUpper === 'FINALIZADO' || statusUpper === 'ABERTO';
          const isRecebidoPorBlank = !finalRecPor;
          if (isTargetStatus && isRecebidoPorBlank) {
            finalRecPor = 'LUIZ CARLOS';
          }

          let finalLidoPor = (data.lidoPor || '').trim();
          if (finalLidoPor.toUpperCase() === 'LUIZ') {
            finalLidoPor = 'LUIZ CARLOS';
          }

          let finalConferidoPor = (data.conferidoPor || '').trim();
          if (finalConferidoPor.toUpperCase() === 'LUIZ') {
            finalConferidoPor = 'LUIZ CARLOS';
          }

          return {
            ...data,
            id: d.id,
            recebidoPor: finalRecPor,
            lidoPor: finalLidoPor,
            conferidoPor: finalConferidoPor
          } as Batch;
        });
        setBatches(docsMapped);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'batches')
    );

    const unsubPacs = onSnapshot(
      query(collection(db, 'pacs'), orderBy('name')),
      (snapshot) => setPacs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ConfigItem))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'pacs')
    );

    const unsubCollabs = onSnapshot(
      query(collection(db, 'collaborators'), orderBy('name')),
      (snapshot) => {
        const list = snapshot.docs.map(d => {
          const data = d.data();
          let name = (data.name || '').trim();
          if (name.toUpperCase() === 'LUIZ') {
            name = 'LUIZ CARLOS';
          }
          return { id: d.id, ...data, name } as ConfigItem;
        });

        // Deduplicate collaborator names locally (case-insensitive mapping)
        const seenNames = new Set<string>();
        const uniqueList: ConfigItem[] = [];

        list.forEach(c => {
          const norm = c.name.toUpperCase().trim();
          if (norm && !seenNames.has(norm)) {
            seenNames.add(norm);
            uniqueList.push(c);
          }
        });

        const hasLuizCarlos = seenNames.has('LUIZ CARLOS');
        if (!hasLuizCarlos) {
          uniqueList.push({ id: 'local-luiz-carlos', name: 'LUIZ CARLOS' });
        }

        setCollaborators(uniqueList.sort((a, b) => a.name.localeCompare(b.name)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'collaborators')
    );

    const unsubStatuses = onSnapshot(
      query(collection(db, 'statuses'), orderBy('name')),
      (snapshot) => setStatuses(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ConfigItem))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'statuses')
    );

    return () => {
      unsubBatches();
      unsubPacs();
      unsubCollabs();
      unsubStatuses();
    };
  }, [user, isLocalMode]);

  // Background migration for database normalization (runs exactly once per mount in online mode to prevent infinite sync loops)
  const migrationRunRef = useRef(false);
  useEffect(() => {
    if (isLocalMode) return;
    if (migrationRunRef.current) return;
    migrationRunRef.current = true;

    const runMigration = async () => {
      try {
        // 1. Migrate Collaborators
        const collSnapshot = await getDocs(collection(db, 'collaborators'));
        const colls = collSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const hasLuizCarlos = colls.some(c => c.name.toUpperCase().trim() === 'LUIZ CARLOS');

        if (!hasLuizCarlos) {
          await addDoc(collection(db, 'collaborators'), { name: 'LUIZ CARLOS' });
        }

        for (const c of colls) {
          const nameUpper = c.name.toUpperCase().trim();
          if (nameUpper === 'LUIZ') {
            if (hasLuizCarlos) {
              await deleteDoc(doc(db, 'collaborators', c.id));
            } else {
              await updateDoc(doc(db, 'collaborators', c.id), { name: 'LUIZ CARLOS' });
            }
          }
        }

        // 2. Migrate Batches (Fix blank recebidoPor or LUIZ renamed to LUIZ CARLOS)
        const batchSnapshot = await getDocs(collection(db, 'batches'));
        const batchPromises = batchSnapshot.docs.map(async (d) => {
          const data = d.data();
          let finalRecPor = (data.recebidoPor || '').trim();
          let finalLidoPor = (data.lidoPor || '').trim();
          let finalConfPor = (data.conferidoPor || '').trim();
          let needsUpdate = false;

          if (finalRecPor.toUpperCase().trim() === 'LUIZ') {
            finalRecPor = 'LUIZ CARLOS';
            needsUpdate = true;
          }

          const statusUpper = (data.status || '').toUpperCase().trim();
          const isTargetStatus = statusUpper === 'FINALIZADO' || statusUpper === 'ABERTO';
          const isRecebidoPorBlank = !finalRecPor;

          if (isTargetStatus && isRecebidoPorBlank) {
            finalRecPor = 'LUIZ CARLOS';
            needsUpdate = true;
          }

          if (finalLidoPor.toUpperCase().trim() === 'LUIZ') {
            finalLidoPor = 'LUIZ CARLOS';
            needsUpdate = true;
          }

          if (finalConfPor.toUpperCase().trim() === 'LUIZ') {
            finalConfPor = 'LUIZ CARLOS';
            needsUpdate = true;
          }

          if (needsUpdate) {
            await updateDoc(doc(db, 'batches', d.id), {
              recebidoPor: finalRecPor,
              lidoPor: finalLidoPor,
              conferidoPor: finalConfPor
            });
          }
        });

        await Promise.all(batchPromises);
      } catch (err) {
        console.error("Failed to run background database migration:", err);
      }
    };

    const timer = setTimeout(() => {
      runMigration();
    }, 2000);

    return () => clearTimeout(timer);
  }, [isLocalMode]);

  // Filtered Batches
  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = b.pac.toLowerCase().includes(term) ||
        b.status.toLowerCase().includes(term) ||
        (b.recebidoPor && b.recebidoPor.toLowerCase().includes(term)) ||
        (b.lidoPor && b.lidoPor.toLowerCase().includes(term)) ||
        (b.conferidoPor && b.conferidoPor.toLowerCase().includes(term));
      
      const deadline = addDays(b.periodoInicial.toDate(), 30);
      const daysRemaining = differenceInDays(deadline, new Date());
      const isOverdue = isAfter(new Date(), deadline);
      const isWarning = !isOverdue && daysRemaining <= 10;
      const isFinished = !!b.conferidoPor;

      // Status Filter Logic
      if (statusFilter === 'open' && isFinished) return false;
      if (statusFilter === 'finished' && !isFinished) return false;
      if (statusFilter === 'ATRASO' && !isOverdue) return false;
      if (statusFilter === 'ALERTA' && !isWarning) return false;
      if (statusFilter === 'EM DIA' && (isOverdue || isWarning || isFinished)) return false;

      // Dashboard Period Filter
      if (dashStartDate) {
        const start = startOfDay(parseLocalDate(dashStartDate));
        if (b.periodoInicial.toDate() < start) return false;
      }
      if (dashEndDate) {
        const end = startOfDay(parseLocalDate(dashEndDate));
        if (startOfDay(b.periodoFinal.toDate()) > end) return false;
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

    batches.forEach(b => {
      // Check if batch is within dashboard period filter
      let match = true;
      if (dashStartDate) {
        const start = startOfDay(parseLocalDate(dashStartDate));
        if (b.periodoInicial.toDate() < start) match = false;
      }
      if (dashEndDate) {
        const end = startOfDay(parseLocalDate(dashEndDate));
        if (startOfDay(b.periodoFinal.toDate()) > end) match = false;
      }

      if (match) {
        if (!b.conferidoPor) {
          totalEnsaiosOpen += b.numEnsaios;
        } else {
          totalEnsaiosFinished += b.numEnsaios;
          
          // On time vs Late
          const deadline = addDays(b.periodoInicial.toDate(), 30);
          if (isAfter(b.conferidoEm!.toDate(), deadline)) {
            lateCount++;
          } else {
            onTimeCount++;
          }
        }
      }
    });

    const totalFinished = onTimeCount + lateCount;

    return {
      onTimeCount,
      lateCount,
      totalFinished,
      totalEnsaiosFinished,
      totalEnsaiosOpen
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

  const handleUpdateConfig = async (type: string, id: string, name: string) => {
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
      }
      return;
    }
    try {
      await updateDoc(doc(db, type, id), { name });
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
                onClick={() => setActiveTab('config')}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all",
                  activeTab === 'config' ? "bg-[#5A5A40] text-white" : "text-[#5A5A40] hover:bg-[#f0f0e5]"
                )}
              >
                Configurações
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
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} />
              <p className="text-sm">{error}</p>
            </div>
            <button onClick={() => setError(null)}><X size={18} /></button>
          </div>
        )}

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                  <p className="text-xs font-bold uppercase text-[#5A5A40] opacity-60">Finalizados (Mês)</p>
                  <p className="text-2xl font-bold">{stats.totalEnsaiosFinished}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[24px] border border-[#e5e5e0] flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
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
          <StatsPanel batches={batches} collaborators={collaborators} />
        ) : (
          <ConfigPanel 
            pacs={pacs} 
            collaborators={collaborators} 
            statuses={statuses}
            handleFirestoreError={handleFirestoreError}
            onUpdate={handleUpdateConfig}
            setConfigToDelete={setConfigToDelete}
            isLocalMode={isLocalMode}
            batches={batches}
            setBatches={setBatches}
            setPacs={setPacs}
            setCollaborators={setCollaborators}
            setStatuses={setStatuses}
          />
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
            handleFirestoreError={handleFirestoreError}
            isLocalMode={isLocalMode}
            onSaveLocalBatch={(localBatch: any) => {
              let updated;
              if (editingBatch) {
                updated = batches.map(b => b.id === editingBatch.id ? { ...b, ...localBatch } : b);
              } else {
                updated = [{ ...localBatch, id: 'local-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9) }, ...batches];
              }
              updated.sort((a, b) => b.recebidoEm.toDate().getTime() - a.recebidoEm.toDate().getTime());
              setBatches(updated);
              localStorage.setItem('lotes_batches', JSON.stringify(updated));
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
  const deadline = addDays(batch.periodoInicial.toDate(), 30);
  const daysRemaining = differenceInDays(deadline, new Date());
  const isOverdue = isAfter(new Date(), deadline);
  const isWarning = !isOverdue && daysRemaining <= 10;

  const dynamicStatus = isOverdue ? 'EM ATRASO' : isWarning ? 'ALERTA' : batch.status;

  return (
    <div className={cn(
      "bg-white rounded-[24px] p-6 border transition-all group",
      isOverdue ? "border-red-200 bg-red-50/10" : isWarning ? "border-amber-200 bg-amber-50/10" : "border-[#e5e5e0]"
    )}>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Info */}
        <div className="flex-1">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#5A5A40] opacity-60">PAC</span>
                <h3 className="text-xl font-display font-bold tracking-tight">{batch.pac}</h3>
              </div>
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

function BatchModal({ isOpen, onClose, batch, pacs, collaborators, statuses, handleFirestoreError, isLocalMode, onSaveLocalBatch }: any) {
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
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Auto-status logic: if "Lido" and "Informado" fields are filled, status becomes FINALIZADO automatically
    let finalStatus = formData.status;
    if (formData.lidoPor.trim() && formData.conferidoPor.trim()) {
      finalStatus = 'FINALIZADO';
    }

    // Validation for FINALIZADO status
    if (finalStatus === 'FINALIZADO') {
      if (!formData.lidoPor.trim() || !formData.conferidoPor.trim()) {
        setLocalError('Para definir como FINALIZADO, é necessário informar quem Leu e Informou.');
        return;
      }
    }

    try {
      const getTimestampFromDate = (date: Date) => {
        return isLocalMode ? LocalTimestamp.fromDate(date) : Timestamp.fromDate(date);
      };
      
      const getTimestampNow = () => {
        return isLocalMode ? LocalTimestamp.now() : Timestamp.now();
      };

      let finalRecebidoPor = formData.recebidoPor.trim();
      if (finalRecebidoPor.toUpperCase().trim() === 'LUIZ') {
        finalRecebidoPor = 'LUIZ CARLOS';
      }
      const statusUpper = finalStatus.toUpperCase().trim();
      if ((statusUpper === 'FINALIZADO' || statusUpper === 'ABERTO') && !finalRecebidoPor) {
        finalRecebidoPor = 'LUIZ CARLOS';
      }

      let finalLidoPor = formData.lidoPor.trim();
      if (finalLidoPor.toUpperCase().trim() === 'LUIZ') {
        finalLidoPor = 'LUIZ CARLOS';
      }

      let finalConferidoPor = formData.conferidoPor.trim();
      if (finalConferidoPor.toUpperCase().trim() === 'LUIZ') {
        finalConferidoPor = 'LUIZ CARLOS';
      }

      const data = {
        ...formData,
        status: finalStatus,
        recebidoPor: finalRecebidoPor,
        lidoPor: finalLidoPor,
        conferidoPor: finalConferidoPor,
        numEnsaios: Number(formData.numEnsaios),
        periodoInicial: getTimestampFromDate(parseLocalDate(formData.periodoInicial)),
        periodoFinal: getTimestampFromDate(parseLocalDate(formData.periodoFinal)),
        recebidoEm: batch?.recebidoEm || getTimestampNow(),
        lidoEm: finalLidoPor ? (batch?.lidoPor ? batch.lidoEm : getTimestampNow()) : null,
        conferidoEm: finalConferidoPor ? (batch?.conferidoPor ? batch.conferidoEm : getTimestampNow()) : null,
      };

      if (isLocalMode) {
        onSaveLocalBatch(data);
        onClose();
        return;
      }

      if (batch) {
        await updateDoc(doc(db, 'batches', batch.id), data);
      } else {
        await addDoc(collection(db, 'batches'), data);
      }
      onClose();
    } catch (err) {
      handleFirestoreError(err, batch ? OperationType.UPDATE : OperationType.CREATE, 'batches');
    }
  };

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
            </div>
          </div>

          <div className="pt-6 flex gap-3">
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
  handleFirestoreError, 
  onUpdate, 
  setConfigToDelete, 
  isLocalMode, 
  batches, 
  setBatches, 
  setPacs, 
  setCollaborators, 
  setStatuses 
}: any) {
  const [activeConfig, setActiveConfig] = useState<'pacs' | 'collabs' | 'status' | 'import'>('pacs');
  const [newItemName, setNewItemName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

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
        let recebidoPor = cleanString(getVal(['RECEBIDO POR', 'Recebido Por', 'Responsável', 'Responsavel', 'Cadastrado Por']) || 'Sistema');
        if (recebidoPor.toUpperCase().trim() === 'LUIZ') {
          recebidoPor = 'LUIZ CARLOS';
        }
        const recebidoEmVal = getVal(['recebido em', 'Recebido Em', 'Data Recebimento', 'Data de Recebimento', 'RecebidoNoDia']);
        
        let lidoPor = cleanString(getVal(['LIDO POR', 'Lido Por', 'Regularizado Por', 'Lido', 'LidoPor']));
        if (lidoPor.toUpperCase().trim() === 'LUIZ') {
          lidoPor = 'LUIZ CARLOS';
        }
        const lidoEmVal = getVal(['lido em', 'Lido Em', 'Regularizado Em', 'Data Regularização', 'Data Regularizacao', 'Data Lido', 'LidoEm']);
        
        let conferidoPor = cleanString(getVal(['CONFERIDO POR', 'Conferido Por', 'Fechado Por', 'Informado Por', 'Informado', 'Conferido', 'ConferidoPor', 'InformadoPor']));
        if (conferidoPor.toUpperCase().trim() === 'LUIZ') {
          conferidoPor = 'LUIZ CARLOS';
        }
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

        if (lidoPor && conferidoPor) {
          status = 'FINALIZADO';
        }

        let finalRecebidoPor = recebidoPor;
        if (finalRecebidoPor.toUpperCase().trim() === 'LUIZ') {
          finalRecebidoPor = 'LUIZ CARLOS';
        }
        const statusUpper = status.toUpperCase().trim();
        if ((statusUpper === 'FINALIZADO' || statusUpper === 'ABERTO') && (!finalRecebidoPor || !finalRecebidoPor.trim())) {
          finalRecebidoPor = 'LUIZ CARLOS';
        }

        const batchData = {
          pac,
          periodoInicial: pInicial || Timestamp.now(),
          periodoFinal: pFinal || Timestamp.now(),
          numEnsaios,
          status,
          recebidoPor: finalRecebidoPor,
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
    const collectionName = activeConfig === 'pacs' ? 'pacs' : activeConfig === 'collabs' ? 'collaborators' : 'statuses';
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
      } else {
        const sorted = [...statuses, newItem].sort((a, b) => a.name.localeCompare(b.name));
        setStatuses(sorted);
        localStorage.setItem('lotes_statuses', JSON.stringify(sorted));
      }
      setNewItemName('');
      return;
    }
    try {
      await addDoc(collection(db, collectionName), { name: newItemName });
      setNewItemName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, collectionName);
    }
  };

  const handleDelete = (id: string) => {
    const collectionName = activeConfig === 'pacs' ? 'pacs' : activeConfig === 'collabs' ? 'collaborators' : 'statuses';
    setConfigToDelete({ type: collectionName, id });
  };

  const handleEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingValue(currentName);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingValue.trim()) return;
    const collectionName = activeConfig === 'pacs' ? 'pacs' : activeConfig === 'collabs' ? 'collaborators' : 'statuses';
    try {
      await onUpdate(collectionName, editingId, editingValue.trim());
      setEditingId(null);
      setEditingValue('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${editingId}`);
    }
  };

  const items = activeConfig === 'pacs' ? pacs : activeConfig === 'collabs' ? collaborators : statuses;

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
          onClick={() => setActiveConfig('import')}
          className={cn("px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2", activeConfig === 'import' ? "bg-[#5A5A40] text-white" : "bg-[#f5f5f0] text-[#5A5A40]")}
        >
          <FileSpreadsheet size={16} />
          Importar
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
      ) : (
        <>
          <div className="flex gap-2 mb-6">
        <input 
          type="text" 
          placeholder={`Novo ${activeConfig === 'pacs' ? 'PAC' : activeConfig === 'collabs' ? 'Colaborador' : 'Status'}...`}
          className="flex-1 p-3 bg-[#f5f5f0] border-none rounded-xl focus:ring-2 focus:ring-[#5A5A40]/20"
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

      <div className="space-y-2">
        {items.map((item: any) => (
          <div key={item.id} className="flex items-center justify-between p-4 bg-[#f5f5f0] rounded-xl group">
            {editingId === item.id ? (
              <div className="flex flex-1 gap-2">
                <input 
                  type="text"
                  className="flex-1 px-3 py-1 bg-white border border-[#e5e5e0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20"
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  autoFocus
                />
                <button 
                  onClick={handleSaveEdit}
                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                >
                  <Check size={18} />
                </button>
                <button 
                  onClick={() => setEditingId(null)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <>
                <span className="font-medium">{item.name}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleEdit(item.id, item.name)}
                    className="p-2 text-[#5A5A40] hover:bg-white rounded-lg transition-colors"
                  >
                    <Edit3 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-red-500 hover:bg-white rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  )}
</div>
);
}

function StatsPanel({ batches, collaborators }: { batches: any[]; collaborators: any[] }) {
  const [selectedCollab, setSelectedCollab] = useState<string>('');
  const [statsStartDate, setStatsStartDate] = useState<string>('');
  const [statsEndDate, setStatsEndDate] = useState<string>('');

  // Get unique list of collaborators alphabetically
  const uniqueCollabsAlphabetical = useMemo(() => {
    const list = collaborators.map((c: any) => c.name);
    batches.forEach(b => {
      if (b.lidoPor && !list.includes(b.lidoPor)) list.push(b.lidoPor);
      if (b.conferidoPor && !list.includes(b.conferidoPor)) list.push(b.conferidoPor);
    });
    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
  }, [collaborators, batches]);

  // Compute stats on the batches directly to avoid filtering out work done on older batches
  const computedStats = useMemo(() => {
    const productivity: Record<string, { lido: number, informado: number }> = {};
    
    let onTimeCount = 0;
    let lateCount = 0;
    let totalEnsaiosFinished = 0;
    let totalEnsaiosOpen = 0;

    const startLimit = statsStartDate ? startOfDay(parseLocalDate(statsStartDate)) : null;
    const endLimit = statsEndDate ? startOfDay(parseLocalDate(statsEndDate)) : null;

    const toJSDate = (ts: any): Date | null => {
      if (!ts) return null;
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
      return isNaN(d.getTime()) ? null : d;
    };

    batches.forEach(b => {
      // 1. Reading Productivity (LIDO POR + lidoEm)
      if (b.lidoPor && b.lidoPor.trim()) {
        const lidoName = b.lidoPor.trim();
        const lidoDate = toJSDate(b.lidoEm);
        
        let matchCollab = !selectedCollab || lidoName === selectedCollab;
        let matchPeriod = true;
        if (lidoDate) {
          if (startLimit && lidoDate < startLimit) matchPeriod = false;
          if (endLimit && startOfDay(lidoDate) > endLimit) matchPeriod = false;
        } else {
          // If a period is specified but there's no date, we don't count it for that period
          if (startLimit || endLimit) matchPeriod = false;
        }

        if (matchCollab && matchPeriod) {
          if (!productivity[lidoName]) {
            productivity[lidoName] = { lido: 0, informado: 0 };
          }
          productivity[lidoName].lido += Number(b.numEnsaios || 0);
        }
      }

      // 2. Checking / Informing Productivity (CONFERIDO POR + conferidoEm)
      if (b.conferidoPor && b.conferidoPor.trim()) {
        const confName = b.conferidoPor.trim();
        const confDate = toJSDate(b.conferidoEm);

        let matchCollab = !selectedCollab || confName === selectedCollab;
        let matchPeriod = true;
        if (confDate) {
          if (startLimit && confDate < startLimit) matchPeriod = false;
          if (endLimit && startOfDay(confDate) > endLimit) matchPeriod = false;
        } else {
          if (startLimit || endLimit) matchPeriod = false;
        }

        if (matchCollab && matchPeriod) {
          if (!productivity[confName]) {
            productivity[confName] = { lido: 0, informado: 0 };
          }
          productivity[confName].informado += Number(b.numEnsaios || 0);

          // Track Quality Stats (Only for matched and within-period checked batches)
          totalEnsaiosFinished += Number(b.numEnsaios || 0);
          
          const deadlineDate = b.periodoInicial ? addDays(toJSDate(b.periodoInicial) || new Date(), 30) : null;
          if (deadlineDate && confDate) {
            if (isAfter(confDate, deadlineDate)) {
              lateCount++;
            } else {
              onTimeCount++;
            }
          } else {
            onTimeCount++;
          }
        }
      }

      // 3. Open batches calculation (no conferidoPor)
      if (!b.conferidoPor) {
        const initDate = toJSDate(b.periodoInicial);
        let matchPeriod = true;
        if (initDate) {
          if (startLimit && initDate < startLimit) matchPeriod = false;
          if (endLimit && startOfDay(initDate) > endLimit) matchPeriod = false;
        } else {
          if (startLimit || endLimit) matchPeriod = false;
        }

        let matchCollab = true;
        if (selectedCollab) {
          matchCollab = (b.lidoPor && b.lidoPor.trim() === selectedCollab) || false;
        }

        if (matchCollab && matchPeriod) {
          totalEnsaiosOpen += Number(b.numEnsaios || 0);
        }
      }
    });

    // If a specific collaborator is filtered, make sure they show in list even with zero counts
    if (selectedCollab && !productivity[selectedCollab]) {
      productivity[selectedCollab] = { lido: 0, informado: 0 };
    }

    // List the collaborator's productivity sorted alphabetically
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
  }, [batches, selectedCollab, statsStartDate, statsEndDate]);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Filtros da Tela Estatísticas */}
      <div className="bg-white p-6 rounded-[32px] border border-[#e5e5e0]">
        <div className="flex flex-col lg:flex-row gap-6 items-end justify-between">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 w-full">
            {/* Filtro por Colaborador */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-[#5A5A40]">Filtar por Colaborador</label>
              <select
                className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:outline-none font-medium text-gray-700"
                value={selectedCollab}
                onChange={(e) => setSelectedCollab(e.target.value)}
              >
                <option value="">Todos os Colaboradores</option>
                {uniqueCollabsAlphabetical.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            {/* Período Inicial */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-[#5A5A40]">Período Inicial (Filtro)</label>
              <input
                type="date"
                className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:outline-none font-medium text-gray-700"
                value={statsStartDate}
                onChange={(e) => setStatsStartDate(e.target.value)}
              />
            </div>
            {/* Período Final */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-[#5A5A40]">Período Final (Filtro)</label>
              <input
                type="date"
                className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl text-sm focus:ring-2 focus:ring-[#5A5A40]/20 focus:outline-none font-medium text-gray-700"
                value={statsEndDate}
                onChange={(e) => setStatsEndDate(e.target.value)}
              />
            </div>
          </div>
          {/* Ações de Limpeza */}
          {(selectedCollab || statsStartDate || statsEndDate) && (
            <button
              onClick={() => {
                setSelectedCollab('');
                setStatsStartDate('');
                setStatsEndDate('');
              }}
              className="w-full lg:w-auto px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all"
            >
              Limpar Filtros
            </button>
          )}
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
    </div>
  );
}
