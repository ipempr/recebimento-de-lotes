import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface ConfigPasswordGateProps {
  correctPassword: string;
  onUnlock: () => void;
  onCancel: () => void;
}

export function ConfigPasswordGate({ correctPassword, onUnlock, onCancel }: ConfigPasswordGateProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Por favor, insira a senha de acesso.');
      return;
    }

    if (password === correctPassword) {
      setError(null);
      onUnlock();
    } else {
      setError('Senha incorreta. Por favor, tente novamente.');
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 animate-in fade-in slide-in-from-bottom-4 duration-300" id="password-gate-container">
      <div className="bg-white rounded-[32px] p-8 border border-[#e5e5e0] shadow-sm flex flex-col items-center text-center" id="password-gate-card">
        <div className="w-16 h-16 bg-[#f5f5f0] border border-[#e5e5e0] rounded-full flex items-center justify-center text-[#5A5A40] mb-6" id="lock-icon-wrapper">
          <Lock size={28} />
        </div>

        <h3 className="font-display font-bold text-2xl text-[#3A3A28] tracking-tight mb-2" id="gate-title">
          Área Restrita
        </h3>
        <p className="text-sm text-[#5A5A40]/80 leading-relaxed mb-6" id="gate-description">
          A aba de <strong>Configurações do Sistema</strong> é restrita e requer uma senha de acesso para gerenciar os cadastros e dados estruturais.
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-4" id="gate-form">
          <div className="space-y-1.5 text-left" id="password-field-wrapper">
            <label className="text-xs font-bold uppercase tracking-wider text-[#5A5A40]/70" htmlFor="gate-password-input">
              Senha de Acesso
            </label>
            <div className="relative">
              <input
                id="gate-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Digite a senha..."
                className="w-full bg-[#f5f5f0] hover:bg-[#ebebe5] focus:bg-white border border-[#e5e5e0] focus:border-[#5A5A40] focus:ring-1 focus:ring-[#5A5A40] rounded-2xl px-4 py-3 text-sm text-[#3A3A28] outline-none transition-all pr-12"
                autoFocus
              />
              <button
                type="button"
                id="toggle-gate-password"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#5A5A40]/60 hover:text-[#5A5A40] rounded-full hover:bg-black/5 transition"
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3 animate-shake" id="gate-error-banner">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2" id="gate-actions">
            <button
              type="button"
              id="gate-cancel-btn"
              onClick={onCancel}
              className="flex-1 px-4 py-3 bg-[#f5f5f0] hover:bg-[#ebebe5] text-[#5A5A40] font-bold text-sm rounded-2xl transition-colors cursor-pointer"
            >
              Voltar
            </button>
            <button
              type="submit"
              id="gate-submit-btn"
              className="flex-1 px-4 py-3 bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-sm rounded-2xl transition-colors shadow-sm cursor-pointer"
            >
              Acessar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
