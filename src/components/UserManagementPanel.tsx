import React, { useState } from 'react';
import { 
  ShieldCheck, 
  UserCheck, 
  UserX, 
  Clock, 
  Lock, 
  Check, 
  X, 
  User as UserIcon, 
  Search,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  Trash2,
  Mail,
  Info,
  Eye,
  Edit3,
  Users,
  Save,
  Shield,
  Key
} from 'lucide-react';
import { format } from 'date-fns';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'ADMIN' | 'OPERADOR' | 'VISUALIZADOR';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt?: any;
  updatedAt?: any;
  approvedBy?: string;
}

interface UserManagementPanelProps {
  currentUser: any;
  currentUserProfile: UserProfile | null;
  allUsers: UserProfile[];
  isLocalMode: boolean;
  onUpdateUserStatus: (uid: string, newStatus: 'APPROVED' | 'PENDING' | 'REJECTED', newRole: 'ADMIN' | 'OPERADOR' | 'VISUALIZADOR') => Promise<void>;
  onAddPreApprovedUser?: (email: string, displayName: string, role: 'ADMIN' | 'OPERADOR' | 'VISUALIZADOR') => Promise<void>;
  onDeleteUserProfile?: (uid: string) => Promise<void>;
}

export default function UserManagementPanel({
  currentUser,
  currentUserProfile,
  allUsers,
  isLocalMode,
  onUpdateUserStatus,
  onAddPreApprovedUser,
  onDeleteUserProfile
}: UserManagementPanelProps) {
  // Tabs: 'all' | 'pending' | 'approved' | 'rejected'
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingUid, setLoadingUid] = useState<string | null>(null);

  // User Profile Detail Modal state
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);
  const [modalRole, setModalRole] = useState<'ADMIN' | 'OPERADOR' | 'VISUALIZADOR'>('OPERADOR');
  const [modalStatus, setModalStatus] = useState<'APPROVED' | 'PENDING' | 'REJECTED'>('APPROVED');
  const [isSavingModal, setIsSavingModal] = useState(false);

  // Pre-approval modal states
  const [isPreApproveModalOpen, setIsPreApproveModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'OPERADOR' | 'VISUALIZADOR'>('OPERADOR');
  const [isSubmittingNewUser, setIsSubmittingNewUser] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const pendingUsers = allUsers.filter(u => u.status === 'PENDING');
  const approvedUsers = allUsers.filter(u => u.status === 'APPROVED');
  const rejectedUsers = allUsers.filter(u => u.status === 'REJECTED');

  const openProfileModal = (user: UserProfile) => {
    setViewingProfile(user);
    setModalRole(user.role || 'OPERADOR');
    setModalStatus(user.status || 'APPROVED');
  };

  const handleSaveProfileModal = async () => {
    if (!viewingProfile) return;
    setIsSavingModal(true);
    try {
      await onUpdateUserStatus(viewingProfile.uid, modalStatus, modalRole);
      setToastMsg(`Status e perfil do usuário ${viewingProfile.email} atualizados com sucesso!`);
      setViewingProfile(null);
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingModal(false);
    }
  };

  const handleQuickStatusChange = async (user: UserProfile, newStatus: 'APPROVED' | 'PENDING' | 'REJECTED') => {
    setLoadingUid(user.uid);
    try {
      await onUpdateUserStatus(user.uid, newStatus, user.role || 'OPERADOR');
      setToastMsg(`Status do usuário ${user.email} alterado para ${newStatus === 'APPROVED' ? 'Aprovado' : newStatus === 'PENDING' ? 'Pendente' : 'Bloqueado'}.`);
      setTimeout(() => setToastMsg(null), 4000);
    } finally {
      setLoadingUid(null);
    }
  };

  const handleQuickRoleChange = async (user: UserProfile, newRole: 'ADMIN' | 'OPERADOR' | 'VISUALIZADOR') => {
    setLoadingUid(user.uid);
    try {
      await onUpdateUserStatus(user.uid, user.status || 'APPROVED', newRole);
      setToastMsg(`Nível de permissão do usuário ${user.email} alterado para ${newRole}.`);
      setTimeout(() => setToastMsg(null), 4000);
    } finally {
      setLoadingUid(null);
    }
  };

  const handlePreApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes('@')) return;

    setIsSubmittingNewUser(true);
    try {
      if (onAddPreApprovedUser) {
        await onAddPreApprovedUser(newEmail, newName, newRole);
      }
      setToastMsg(`O e-mail ${newEmail} foi cadastrado e aprovado como ${newRole} com sucesso!`);
      setNewEmail('');
      setNewName('');
      setNewRole('OPERADOR');
      setIsPreApproveModalOpen(false);
      setActiveSubTab('all');
      setTimeout(() => setToastMsg(null), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingNewUser(false);
    }
  };

  const filteredUsers = (
    activeSubTab === 'all' 
      ? allUsers 
      : activeSubTab === 'pending' 
      ? pendingUsers 
      : activeSubTab === 'approved' 
      ? approvedUsers 
      : rejectedUsers
  ).filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.displayName && u.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatTimestamp = (ts: any) => {
    if (!ts) return '-';
    if (typeof ts.toDate === 'function') {
      return format(ts.toDate(), 'dd/MM/yyyy HH:mm');
    }
    if (ts instanceof Date) {
      return format(ts, 'dd/MM/yyyy HH:mm');
    }
    return String(ts);
  };

  return (
    <div className="space-y-6">
      {/* Informative Banner */}
      <div className="bg-gradient-to-r from-[#5A5A40] to-[#3a3a28] p-6 rounded-[28px] text-white shadow-lg space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm">
            <Info size={24} className="text-amber-300" />
          </div>
          <div>
            <h3 className="text-lg font-display font-bold tracking-tight">
              Gestão Central de Perfis & Controle de Acesso
            </h3>
            <p className="text-xs text-amber-100/90 leading-relaxed mt-0.5">
              Aqui você pode visualizar o perfil de todos os usuários cadastrados, alterar seus níveis de permissão (Administrador, Operador, Visualizador) ou alterar seu status de acesso (Aprovado, Pendente, Bloqueado) em tempo real.
            </p>
          </div>
        </div>
      </div>

      {/* Success alert message */}
      {toastMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl flex items-center justify-between text-xs font-semibold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <span>{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Panel Header */}
      <div className="bg-white p-6 rounded-[28px] border border-[#e5e5e0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-[#5A5A40] text-white rounded-2xl flex items-center justify-center shadow-md shrink-0">
            <ShieldCheck size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-display font-bold text-gray-900 tracking-tight">
                Usuários do Aplicativo
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                {allUsers.length} Cadastrado(s)
              </span>
            </div>
            <p className="text-xs text-[#5A5A40] mt-1">
              Gerencie privilégios, visualize o perfil detalhado e altere a liberação de cada colaborador.
            </p>
          </div>
        </div>

        {/* Action Button & Stats Pills */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={() => setIsPreApproveModalOpen(true)}
            className="px-4 py-3 bg-[#5A5A40] hover:bg-[#4a4a30] text-white font-bold text-xs rounded-2xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <UserPlus size={18} />
            <span>Cadastrar / Pré-aprovar Usuário</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-2xl text-center">
              <p className="text-[9px] uppercase font-bold text-gray-500">Total</p>
              <p className="text-base font-bold text-gray-800">{allUsers.length}</p>
            </div>
            <div className="px-3.5 py-2 bg-amber-50 border border-amber-200/80 rounded-2xl text-center">
              <p className="text-[9px] uppercase font-bold text-amber-800">Pendentes</p>
              <p className="text-base font-bold text-amber-900">{pendingUsers.length}</p>
            </div>
            <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200/80 rounded-2xl text-center">
              <p className="text-[9px] uppercase font-bold text-emerald-800">Aprovados</p>
              <p className="text-base font-bold text-emerald-900">{approvedUsers.length}</p>
            </div>
            <div className="px-3.5 py-2 bg-red-50 border border-red-200/80 rounded-2xl text-center">
              <p className="text-[9px] uppercase font-bold text-red-700">Bloqueados</p>
              <p className="text-base font-bold text-red-800">{rejectedUsers.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Role Explanations Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-purple-50/60 border border-purple-200 p-4 rounded-2xl space-y-1">
          <div className="flex items-center gap-2 text-purple-900 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck size={14} className="text-purple-700" />
            <span>Administrador</span>
          </div>
          <p className="text-xs text-purple-900/80 leading-relaxed">
            Acesso irrestrito a todas as funções, configurações, modelos de notificações e aprovação/gestão de novos usuários.
          </p>
        </div>

        <div className="bg-blue-50/60 border border-blue-200 p-4 rounded-2xl space-y-1">
          <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase tracking-wider">
            <UserCheck size={14} className="text-blue-700" />
            <span>Operador</span>
          </div>
          <p className="text-xs text-blue-900/80 leading-relaxed">
            Pode cadastrar e editar lotes, registrar não-conformidades e emitir notificações. Não acessa as configurações nem a gestão de usuários.
          </p>
        </div>

        <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-2xl space-y-1">
          <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs uppercase tracking-wider">
            <Lock size={14} className="text-emerald-700" />
            <span>Visualizador</span>
          </div>
          <p className="text-xs text-emerald-900/80 leading-relaxed">
            Acesso apenas de leitura ao Dashboard, relatórios de produtividade e dados de PACs. Impedido de alterar ou excluir registros.
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs and Search Bar */}
      <div className="bg-white p-4 rounded-[24px] border border-[#e5e5e0] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setActiveSubTab('all')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shrink-0 ${
              activeSubTab === 'all'
                ? 'bg-[#5A5A40] text-white shadow-md'
                : 'bg-[#f5f5f0] text-[#5A5A40] hover:bg-[#e8e8e0]'
            }`}
          >
            <Users size={16} />
            <span>Todos os Usuários ({allUsers.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('pending')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shrink-0 ${
              activeSubTab === 'pending'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'bg-[#f5f5f0] text-[#5A5A40] hover:bg-[#e8e8e0]'
            }`}
          >
            <Clock size={16} />
            <span>Pendentes</span>
            {pendingUsers.length > 0 && (
              <span className="bg-white text-amber-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                {pendingUsers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('approved')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shrink-0 ${
              activeSubTab === 'approved'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-[#f5f5f0] text-[#5A5A40] hover:bg-[#e8e8e0]'
            }`}
          >
            <UserCheck size={16} />
            <span>Aprovados ({approvedUsers.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('rejected')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shrink-0 ${
              activeSubTab === 'rejected'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-[#f5f5f0] text-[#5A5A40] hover:bg-[#e8e8e0]'
            }`}
          >
            <UserX size={16} />
            <span>Bloqueados ({rejectedUsers.length})</span>
          </button>
        </div>

        <div className="relative w-full md:w-64">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por e-mail ou nome..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#f5f5f0] border border-[#e5e5e0] rounded-xl text-xs focus:ring-2 focus:ring-[#5A5A40]/20 focus:outline-none"
          />
        </div>
      </div>

      {/* Users List Container */}
      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="bg-white p-12 rounded-[28px] border border-dashed border-[#e5e5e0] text-center space-y-3">
            <UserIcon className="mx-auto text-gray-300" size={48} />
            <p className="text-sm font-semibold text-gray-600">
              Nenhum usuário encontrado no filtro selecionado.
            </p>
            <p className="text-xs text-gray-400">
              Utilize o botão "Cadastrar / Pré-aprovar Usuário" acima para adicionar e-mails.
            </p>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isSelf = currentUser?.uid === user.uid || currentUser?.email === user.email;
            const isLoading = loadingUid === user.uid;

            return (
              <div
                key={user.uid}
                className="bg-white p-5 rounded-[24px] border border-[#e5e5e0] shadow-sm hover:border-[#5A5A40]/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* User Info */}
                <div className="flex items-center gap-4">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || user.email}
                      className="w-12 h-12 rounded-full border border-gray-200 object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#5A5A40] text-white font-bold text-lg flex items-center justify-center shrink-0">
                      {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-gray-900 text-sm">
                        {user.displayName || user.email.split('@')[0]}
                      </h4>
                      {isSelf && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                          Você
                        </span>
                      )}

                      {/* Status Badge */}
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          user.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : user.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-red-100 text-red-800 border-red-200'
                        }`}
                      >
                        {user.status === 'APPROVED' ? 'APROVADO' : user.status === 'PENDING' ? 'PENDENTE' : 'BLOQUEADO'}
                      </span>

                      {/* Role Badge */}
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          user.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-800 border-purple-200'
                            : user.role === 'OPERADOR'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                      >
                        {user.role === 'ADMIN' ? 'ADMINISTRADOR' : user.role === 'OPERADOR' ? 'OPERADOR' : 'VISUALIZADOR'}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 font-mono mt-0.5">{user.email}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Registrado em: {formatTimestamp(user.createdAt)}
                      {user.approvedBy && ` • Aprovado por: ${user.approvedBy}`}
                    </p>
                  </div>
                </div>

                {/* Direct Control Selectors & Actions */}
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  {/* Direct Status Selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-[#5A5A40] block">Status de Acesso</label>
                    <select
                      value={user.status || 'APPROVED'}
                      disabled={isLoading || (isSelf && user.role === 'ADMIN')}
                      onChange={(e) => {
                        const newStatus = e.target.value as 'APPROVED' | 'PENDING' | 'REJECTED';
                        handleQuickStatusChange(user, newStatus);
                      }}
                      className="px-3 py-2 bg-[#f5f5f0] border border-[#e5e5e0] rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 cursor-pointer"
                    >
                      <option value="APPROVED">🟢 Aprovado</option>
                      <option value="PENDING">🟡 Pendente</option>
                      <option value="REJECTED">🔴 Bloqueado</option>
                    </select>
                  </div>

                  {/* Direct Role Selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-[#5A5A40] block">Nível de Permissão</label>
                    <select
                      value={user.role || 'OPERADOR'}
                      disabled={isLoading || (isSelf && user.role === 'ADMIN')}
                      onChange={(e) => {
                        const newRole = e.target.value as 'ADMIN' | 'OPERADOR' | 'VISUALIZADOR';
                        handleQuickRoleChange(user, newRole);
                      }}
                      className="px-3 py-2 bg-[#f5f5f0] border border-[#e5e5e0] rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 cursor-pointer"
                    >
                      <option value="OPERADOR">Operador (Criar & Editar)</option>
                      <option value="ADMIN">Administrador (Acesso Total)</option>
                      <option value="VISUALIZADOR">Visualizador (Leitura)</option>
                    </select>
                  </div>

                  {/* Ver Perfil Modal Trigger Button */}
                  <div className="pt-4 flex items-center gap-1.5">
                    <button
                      onClick={() => openProfileModal(user)}
                      className="px-3.5 py-2 bg-[#5A5A40] hover:bg-[#4a4a30] text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                      title="Ver Perfil Completo"
                    >
                      <Eye size={15} />
                      <span>Ver Perfil</span>
                    </button>

                    {onDeleteUserProfile && !isSelf && (
                      <button
                        onClick={() => onDeleteUserProfile(user.uid)}
                        disabled={isLoading}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        title="Remover Registro do Usuário"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: DETALHES DO PERFIL DO USUÁRIO */}
      {viewingProfile && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[32px] border border-[#e5e5e0] shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[#e5e5e0] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#5A5A40] text-white rounded-xl flex items-center justify-center">
                  <UserIcon size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Perfil do Usuário</h3>
                  <p className="text-xs text-gray-500">Detalhes do cadastro e alteração de autorização</p>
                </div>
              </div>
              <button
                onClick={() => setViewingProfile(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Profile Avatar & Header info */}
            <div className="bg-[#f5f5f0] p-4 rounded-2xl border border-[#e5e5e0] flex items-center gap-4">
              {viewingProfile.photoURL ? (
                <img
                  src={viewingProfile.photoURL}
                  alt={viewingProfile.displayName || viewingProfile.email}
                  className="w-16 h-16 rounded-full border-2 border-white shadow-sm object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#5A5A40] text-white font-bold text-2xl flex items-center justify-center shadow-sm">
                  {(viewingProfile.displayName || viewingProfile.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h4 className="font-bold text-gray-900 text-base">
                  {viewingProfile.displayName || 'Sem Nome Cadastrado'}
                </h4>
                <p className="text-xs font-mono text-[#5A5A40] mt-0.5">{viewingProfile.email}</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  ID do Usuário (UID): <span className="font-mono">{viewingProfile.uid}</span>
                </p>
              </div>
            </div>

            {/* Interactive Form for Changing Status & Role */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Shield size={15} className="text-[#5A5A40]" />
                  <span>Status da Autorização do Acesso</span>
                </label>
                <select
                  value={modalStatus}
                  onChange={e => setModalStatus(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-[#f5f5f0] border border-[#e5e5e0] rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-[#5A5A40]/20 focus:outline-none"
                >
                  <option value="APPROVED">🟢 Aprovado (Acesso Liberado ao Sistema)</option>
                  <option value="PENDING">🟡 Pendente (Bloqueado aguardando aprovação)</option>
                  <option value="REJECTED">🔴 Bloqueado (Acesso Negado/Recusado)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Key size={15} className="text-[#5A5A40]" />
                  <span>Nível de Permissão (Cargo)</span>
                </label>
                <select
                  value={modalRole}
                  onChange={e => setModalRole(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-[#f5f5f0] border border-[#e5e5e0] rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-[#5A5A40]/20 focus:outline-none"
                >
                  <option value="OPERADOR">Operador (Criar, Editar e Registrar Ensaio)</option>
                  <option value="ADMIN">Administrador (Controle Total & Configurações)</option>
                  <option value="VISUALIZADOR">Visualizador (Apenas Consulta / Leitura)</option>
                </select>
              </div>

              {/* Info Badges */}
              <div className="bg-amber-50/70 border border-amber-200/80 p-3 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                <p>
                  <strong>Data de Criação:</strong> {formatTimestamp(viewingProfile.createdAt)}
                </p>
                {viewingProfile.approvedBy && (
                  <p className="mt-0.5">
                    <strong>Última Alteração Por:</strong> {viewingProfile.approvedBy}
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#e5e5e0]">
              <button
                type="button"
                onClick={() => setViewingProfile(null)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition-all"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSaveProfileModal}
                disabled={isSavingModal}
                className="px-5 py-2.5 bg-[#5A5A40] hover:bg-[#4a4a30] text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Save size={16} />
                <span>Salvar Alterações de Perfil</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Pre-Approving a New User Email */}
      {isPreApproveModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[32px] border border-[#e5e5e0] shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#e5e5e0] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#5A5A40] text-white rounded-xl flex items-center justify-center">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Cadastrar & Pré-aprovar Usuário</h3>
                  <p className="text-xs text-gray-500">Adicione e-mails para liberação imediata</p>
                </div>
              </div>
              <button
                onClick={() => setIsPreApproveModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePreApproveSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  <Mail size={14} className="text-[#5A5A40]" />
                  <span>Endereço de E-mail Google</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="ex: colaborador@ipem.pr.gov.br ou usuario@gmail.com"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#f5f5f0] border border-[#e5e5e0] rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#5A5A40]/20 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">
                  Nome do Colaborador (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="ex: João da Silva"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#f5f5f0] border border-[#e5e5e0] rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#5A5A40]/20 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">
                  Nível de Permissão Inicial
                </label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-[#f5f5f0] border border-[#e5e5e0] rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20"
                >
                  <option value="OPERADOR">Operador (Criar & Editar Lotes)</option>
                  <option value="ADMIN">Administrador (Acesso Total)</option>
                  <option value="VISUALIZADOR">Visualizador (Apenas Leitura)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPreApproveModalOpen(false)}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewUser || !newEmail}
                  className="px-5 py-2.5 bg-[#5A5A40] hover:bg-[#4a4a30] text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Check size={16} />
                  <span>Cadastrar & Aprovado</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
