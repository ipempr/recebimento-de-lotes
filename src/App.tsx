/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  Loader2
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

export default function App() {
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      setError('Falha no login');
    }
  };

  const handleLogout = () => signOut(auth);

  // Data Fetching
  useEffect(() => {
    if (!user) return;

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
      collection(db, 'pacs'),
      (snapshot) => setPacs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ConfigItem))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'pacs')
    );

    const unsubCollabs = onSnapshot(
      collection(db, 'collaborators'),
      (snapshot) => setCollaborators(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ConfigItem))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'collaborators')
    );

    const unsubStatuses = onSnapshot(
      collection(db, 'statuses'),
      (snapshot) => setStatuses(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ConfigItem))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'statuses')
    );

    return () => {
      unsubBatches();
      unsubPacs();
      unsubCollabs();
      unsubStatuses();
    };
  }, [user]);

  // Filtered Batches
  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      const matchesSearch = b.pac.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.recebidoPor.toLowerCase().includes(searchTerm.toLowerCase());
      
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

      return matchesSearch;
    });
  }, [batches, searchTerm, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const openBatches = batches.filter(b => !b.conferidoPor);
    const totalOpen = openBatches.length;
    
    // Productivity: collaborator -> { lido: N, informado: N }
    const productivity: Record<string, { lido: number, informado: number }> = {};
    
    let onTimeCount = 0;
    let lateCount = 0;
    let totalEnsaiosFinished = 0;
    let totalEnsaiosOpen = 0;

    batches.forEach(b => {
      if (!b.conferidoPor) {
        totalEnsaiosOpen += b.numEnsaios;
      }

      // Track Reading
      if (b.lidoPor) {
        if (!productivity[b.lidoPor]) productivity[b.lidoPor] = { lido: 0, informado: 0 };
        productivity[b.lidoPor].lido += b.numEnsaios;
      }
      // Track Informing
      if (b.conferidoPor) {
        if (!productivity[b.conferidoPor]) productivity[b.conferidoPor] = { lido: 0, informado: 0 };
        productivity[b.conferidoPor].informado += b.numEnsaios;
        totalEnsaiosFinished += b.numEnsaios;
        
        // On time vs Late
        const deadline = addDays(b.periodoInicial.toDate(), 30);
        if (isAfter(b.conferidoEm!.toDate(), deadline)) {
          lateCount++;
        } else {
          onTimeCount++;
        }
      }
    });

    return {
      totalOpen,
      productivity: Object.entries(productivity).sort((a, b) => {
        const totalA = a[1].lido + a[1].informado;
        const totalB = b[1].lido + b[1].informado;
        return totalB - totalA;
      }),
      onTimeCount,
      lateCount,
      totalFinished: onTimeCount + lateCount,
      totalEnsaiosFinished,
      totalEnsaiosOpen
    };
  }, [batches]);

  const handleDeleteBatch = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'batches', id));
      setBatchToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `batches/${id}`);
    }
  };

  const handleUpdateConfig = async (type: string, id: string, name: string) => {
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
        <div className="max-w-md w-full bg-white rounded-[32px] p-12 shadow-xl text-center">
          <h1 className="text-4xl font-serif mb-6 text-[#1a1a1a]">Gestão de Lotes</h1>
          <p className="text-[#5A5A40] mb-8">Acesse com sua conta Google para gerenciar os ensaios.</p>
          <button 
            onClick={handleLogin}
            className="w-full bg-[#5A5A40] text-white rounded-full py-4 font-medium hover:bg-[#4a4a30] transition-colors flex items-center justify-center gap-3"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Entrar com Google
          </button>
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
            <h1 className="text-2xl font-serif font-bold">Lotes Ensaio</h1>
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
          <StatsPanel stats={stats} />
        ) : (
          <ConfigPanel 
            pacs={pacs} 
            collaborators={collaborators} 
            statuses={statuses}
            handleFirestoreError={handleFirestoreError}
            onUpdate={handleUpdateConfig}
            setConfigToDelete={setConfigToDelete}
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
        <h3 className="text-xl font-serif font-bold mb-4">{title}</h3>
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
                <h3 className="text-xl font-bold">{batch.pac}</h3>
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

function BatchModal({ isOpen, onClose, batch, pacs, collaborators, statuses, handleFirestoreError }: any) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    pac: batch?.pac || '',
    periodoInicial: batch?.periodoInicial ? format(batch.periodoInicial.toDate(), "yyyy-MM-dd") : '',
    periodoFinal: batch?.periodoFinal ? format(batch.periodoFinal.toDate(), "yyyy-MM-dd") : '',
    numEnsaios: batch?.numEnsaios || 0,
    status: batch?.status || 'EM ABERTO', // Default to EM ABERTO
    recebidoPor: batch?.recebidoPor || '',
    lidoPor: batch?.lidoPor || '',
    conferidoPor: batch?.conferidoPor || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation for FINALIZADO status
    if (formData.status === 'FINALIZADO') {
      if (!formData.lidoPor || !formData.conferidoPor) {
        setLocalError('Para definir como FINALIZADO, é necessário informar quem Leu e Informou.');
        return;
      }
    }

    try {
      const data = {
        ...formData,
        numEnsaios: Number(formData.numEnsaios),
        periodoInicial: Timestamp.fromDate(new Date(formData.periodoInicial)),
        periodoFinal: Timestamp.fromDate(new Date(formData.periodoFinal)),
        recebidoEm: batch?.recebidoEm || Timestamp.now(),
        lidoEm: formData.lidoPor && !batch?.lidoPor ? Timestamp.now() : (batch?.lidoEm || null),
        conferidoEm: formData.conferidoPor && !batch?.conferidoPor ? Timestamp.now() : (batch?.conferidoEm || null),
      };

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
          <h2 className="text-2xl font-serif font-bold">{batch ? 'Editar Lote' : 'Receber Novo Lote'}</h2>
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
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-[#5A5A40]">PAC</label>
              <select 
                required
                className="w-full p-3 bg-[#f5f5f0] border-none rounded-xl focus:ring-2 focus:ring-[#5A5A40]/20"
                value={formData.pac}
                onChange={e => setFormData({...formData, pac: e.target.value})}
              >
                <option value="">Selecionar PAC</option>
                {pacs.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>

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

function ConfigPanel({ pacs, collaborators, statuses, handleFirestoreError, onUpdate, setConfigToDelete }: any) {
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

  const processExcelData = async (buffer: ArrayBuffer) => {
    try {
      const workbook = read(buffer, { cellDates: true });
      
      // Look for the "PRODUÇÃO" sheet specifically
      let targetSheetName = workbook.SheetNames.find(name => 
        name.trim().toUpperCase() === 'PRODUÇÃO' || 
        name.trim().toUpperCase() === 'PRODUCAO'
      );

      if (!targetSheetName) {
        // Fallback to first sheet if PRODUÇÃO is not found, or throw error?
        // User said "somente a aba PRODUÇÃO deve ser considerada", so let's be strict.
        throw new Error('A aba "PRODUÇÃO" não foi encontrada na planilha.');
      }

      const worksheet = workbook.Sheets[targetSheetName];
      const data = utils.sheet_to_json(worksheet) as any[];

      if (data.length === 0) {
        throw new Error('A planilha está vazia.');
      }

      let importedCount = 0;
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
          
          // If already a Date object (from cellDates: true)
          if (val instanceof Date) {
            return isNaN(val.getTime()) ? null : Timestamp.fromDate(val);
          }

          // Handle DD/MM/AA or DD/MM/YYYY strings
          if (typeof val === 'string' && val.includes('/')) {
            const parts = val.split('/');
            if (parts.length === 3) {
              const day = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10) - 1;
              let year = parseInt(parts[2], 10);
              
              // Handle 2-digit year (AA)
              if (year < 100) {
                year += 2000;
              }
              
              const date = new Date(year, month, day);
              if (!isNaN(date.getTime())) return Timestamp.fromDate(date);
            }
          }

          // Handle Excel serial numbers (if cellDates: true didn't catch it)
          if (typeof val === 'number') {
            // Excel dates start from 1900-01-01
            const date = new Date((val - 25569) * 86400 * 1000);
            if (!isNaN(date.getTime())) return Timestamp.fromDate(date);
          }

          // Fallback to standard Date parsing
          const date = new Date(val);
          return isNaN(date.getTime()) ? null : Timestamp.fromDate(date);
        };

        const pac = String(getVal(['PAC', 'Pacote', 'Lote', 'Identificação']) || '');
        const periodoInicialVal = getVal(['PERÍODO INICIAL', 'Periodo Inicial', 'Data Inicial', 'Inicio']);
        const periodoFinalVal = getVal(['PERÍODO FINAL', 'Periodo Final', 'Data Final', 'Fim']);
        const numEnsaios = Number(getVal(['Nº DE ENSAIOS', 'Ensaios', 'Nº Ensaios', 'Quantidade']) || 0);
        const statusVal = String(getVal(['status', 'Status', 'Situação']) || 'EM ABERTO');
        const recebidoPor = String(getVal(['RECEBIDO POR', 'Recebido Por', 'Responsável']) || 'Sistema');
        const recebidoEmVal = getVal(['recebido em', 'Recebido Em', 'Data Recebimento']);
        
        const lidoPor = String(getVal(['LIDO POR', 'Lido Por', 'Regularizado Por']) || '');
        const lidoEmVal = getVal(['lido em', 'Lido Em', 'Regularizado Em', 'Data Regularização']);
        
        const conferidoPor = String(getVal(['CONFERIDO POR', 'Conferido Por', 'Fechado Por']) || '');
        const conferidoEmVal = getVal(['conferido em', 'Conferido Em', 'Fechado Em', 'Data Fechamento']);
        
        const pInicial = parseExcelDate(periodoInicialVal);
        const pFinal = parseExcelDate(periodoFinalVal);
        const rEm = parseExcelDate(recebidoEmVal);
        const lEm = parseExcelDate(lidoEmVal);
        const cEm = parseExcelDate(conferidoEmVal);

        // Auto-status logic: if workflow fields are filled from spreadsheet, status is FINALIZADO
        let status = statusVal;
        if (lidoPor && conferidoPor) {
          status = 'FINALIZADO';
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
          conferidoEm: cEm || (conferidoPor ? Timestamp.now() : null),
          createdAt: Timestamp.now()
        };

        if (batchData.pac) {
          await addDoc(collection(db, 'batches'), batchData);
          importedCount++;
        }
      }

      if (importedCount === 0 && data.length > 0) {
        throw new Error('Nenhum lote foi importado. Verifique se os nomes das colunas na planilha estão corretos (ex: PAC, PERÍODO INICIAL).');
      }

      setImportStatus({ type: 'success', message: `${importedCount} lotes importados com sucesso!` });
    } catch (err: any) {
      setImportStatus({ type: 'error', message: `Erro ao processar: ${err.message}` });
    } finally {
      setIsImporting(false);
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
      await processExcelData(buffer);
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
      await processExcelData(buffer);
    } catch (err: any) {
      setImportStatus({ type: 'error', message: `Erro no upload: ${err.message}` });
      setIsImporting(false);
    }
  };

  const handleDeleteAllBatches = async () => {
    setIsDeletingAll(true);
    try {
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
            <h4 className="font-serif font-bold text-lg mb-2">Importar de Planilha</h4>
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
                    <span className="text-sm font-medium text-[#5A5A40]/60 group-hover:text-[#5A5A40]">Clique para selecionar arquivo</span>
                    <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} disabled={isImporting} />
                  </div>
                </label>
              </div>

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

function StatsPanel({ stats }: { stats: any }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Productivity by Collaborator x Activity */}
        <div className="lg:col-span-2 bg-white rounded-[32px] p-8 border border-[#e5e5e0]">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="text-[#5A5A40]" size={24} />
            <h3 className="text-xl font-serif font-bold">Produtividade por Atividade</h3>
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
                {stats.productivity.map(([name, data]: [string, any]) => (
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
                {stats.productivity.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-[#5A5A40] opacity-60 italic">
                      Nenhuma atividade registrada ainda.
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
            <h3 className="text-xl font-serif font-bold">Qualidade de Entrega</h3>
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
                  strokeDasharray={`${stats.totalFinished > 0 ? (stats.onTimeCount / stats.totalFinished) * 100 : 0}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-2xl font-bold">
                  {stats.totalFinished > 0 ? Math.round((stats.onTimeCount / stats.totalFinished) * 100) : 0}%
                </span>
                <span className="text-[10px] uppercase font-bold opacity-50">No Prazo</span>
              </div>
            </div>
            <div className="mt-6 flex gap-8 text-sm font-medium">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                <span>No Prazo: {stats.onTimeCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-400 rounded-full" />
                <span>Atrasados: {stats.lateCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
