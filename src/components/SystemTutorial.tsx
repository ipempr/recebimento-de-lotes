import React, { useState } from 'react';
import { 
  BookOpen, 
  LayoutDashboard, 
  BarChart3, 
  Bell, 
  Settings2, 
  Database,
  Calendar, 
  FileText, 
  User, 
  Plus, 
  Search, 
  AlertCircle,
  HelpCircle,
  CheckCircle,
  Clock,
  Sparkles,
  Info,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

export function SystemTutorial() {
  const [activeSection, setActiveSection] = useState<'dashboard' | 'stats' | 'notifications' | 'config' | 'storage'>('dashboard');

  return (
    <div className="bg-white rounded-[32px] border border-[#e5e5e0] overflow-hidden shadow-xs">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#5A5A40] to-[#7A7A5A] p-8 text-white">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-8 h-8" />
          <span className="text-xs font-bold uppercase tracking-widest opacity-80">Suporte & Documentação</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Manual & Tutorial de Operações do Sistema</h1>
        <p className="text-[#f5f5f0]/85 text-xs md:text-sm mt-1 max-w-2xl font-medium">
          Aprenda como operar cada funcionalidade da plataforma de monitoramento de lotes e emissão de notificações regulatórias do IPEM-PR.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row min-h-[600px]">
        {/* Navigation Sidebar */}
        <div className="w-full lg:w-80 bg-[#fbfbf9] border-r border-[#e5e5e0] p-6 shrink-0">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">Módulos do Sistema</h2>
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveSection('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeSection === 'dashboard'
                  ? 'bg-[#5A5A40] text-white shadow-xs'
                  : 'text-[#50503A] hover:bg-[#f0f0e5] hover:text-[#5A5A40]'
              }`}
            >
              <LayoutDashboard size={16} />
              <span>Dashboard & Controle de Lotes</span>
              <ChevronRight size={14} className="ml-auto opacity-70" />
            </button>

            <button
              onClick={() => setActiveSection('stats')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeSection === 'stats'
                  ? 'bg-[#5A5A40] text-white shadow-xs'
                  : 'text-[#50503A] hover:bg-[#f0f0e5] hover:text-[#5A5A40]'
              }`}
            >
              <BarChart3 size={16} />
              <span>Estatísticas de Conformidade</span>
              <ChevronRight size={14} className="ml-auto opacity-70" />
            </button>

            <button
              onClick={() => setActiveSection('notifications')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeSection === 'notifications'
                  ? 'bg-[#5A5A40] text-white shadow-xs'
                  : 'text-[#50503A] hover:bg-[#f0f0e5] hover:text-[#5A5A40]'
              }`}
            >
              <Bell size={16} />
              <span>Gerenciador de Ofícios & Notificações</span>
              <ChevronRight size={14} className="ml-auto opacity-70" />
            </button>

            <button
              onClick={() => setActiveSection('config')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeSection === 'config'
                  ? 'bg-[#5A5A40] text-white shadow-xs'
                  : 'text-[#50503A] hover:bg-[#f0f0e5] hover:text-[#5A5A40]'
              }`}
            >
              <Settings2 size={16} />
              <span>Configurações & Cadastros</span>
              <ChevronRight size={14} className="ml-auto opacity-70" />
            </button>

            <button
              onClick={() => setActiveSection('storage')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeSection === 'storage'
                  ? 'bg-[#5A5A40] text-white shadow-xs'
                  : 'text-[#50503A] hover:bg-[#f0f0e5] hover:text-[#5A5A40]'
              }`}
            >
              <Database size={16} />
              <span>Modo Cloud vs Armazenamento Local</span>
              <ChevronRight size={14} className="ml-auto opacity-70" />
            </button>
          </nav>

          <div className="mt-8 pt-6 border-t border-[#e5e5e0] px-2">
            <div className="bg-[#f0f0e5]/60 rounded-2xl p-4 border border-[#e0e0d5]">
              <div className="flex items-center gap-2 mb-1.5 text-xs font-extrabold text-[#5A5A40]">
                <HelpCircle size={15} />
                <span>Atualização de Versão</span>
              </div>
              <p className="text-[10px] text-[#6A6A50] leading-relaxed">
                Este manual detalha as melhorias implementadas em <strong>Junho de 2026</strong>, como pesquisa textual nos Motivos de Não-Conformidade e tratamento avançado de ensaios entregues fora do prazo.
              </p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 md:p-8">
          
          {/* SECTION: DASHBOARD */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                <LayoutDashboard className="text-[#5A5A40] w-6 h-6" />
                <h3 className="text-lg font-bold text-gray-900">Dashboard & Controle de Lote de Ensaios</h3>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                O Dashboard principal é onde ocorrem os registros do dia a dia. Você pode gerenciar os lotes de ensaios laboratoriais enviados pelos Postos de Atendimento ao Consumidor (PAC). Qualquer irregularidade administrativa (como atraso) ou técnica (placas não-conformes) é documentada aqui para posterior notificação de infração.
              </p>

              {/* Functional highlights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-gray-200 bg-white shadow-xs hover:border-[#5A5A40]/30 transition-colors">
                  <span className="font-bold text-xs text-[#5A5A40] block mb-1">📥 Registro Manual & Inteligente</span>
                  <p className="text-[11px] text-gray-500 leading-normal">
                    Clique em <b>"+ Receber Novo Lote de Ensaios"</b> para abrir o formulário. Preencha informações de período, colaboradores responsáveis (Recebimento, Leitura e Conferência), número de ensaios realizados e marque a opção correspondente caso haja placas não-conformes ou atrasos.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-gray-200 bg-white shadow-xs hover:border-[#5A5A40]/30 transition-colors">
                  <span className="font-bold text-xs text-[#5A5A40] block mb-1">📅 Controle de Ensaio Fora do Prazo (Atrasado)</span>
                  <p className="text-[11px] text-gray-500 leading-normal">
                    Ao marcar <b>"ensaio entregue fora do prazo"</b> nas propriedades do lote, as notificações geradas indicarão automaticamente a infração administrativa correspondente ao período do lote, constando a data inicial, final e o correspondente número de ensaios aferidos.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-gray-200 bg-white shadow-xs hover:border-[#5A5A40]/30 transition-colors">
                  <span className="font-bold text-xs text-[#5A5A40] block mb-1">📊 Importação em Lote por Planilha Excel</span>
                  <p className="text-[11px] text-gray-500 leading-normal">
                    Use a caixa <b>"Arraste ou Selecione seu arquivo Excel (.xlsx) ou CSV"</b> no topo para importar centenas de lotes de uma só vez de forma ágil e segura. O sistema analisa duplicidades de entrada e cadastra instantaneamente PACs e colaboradores novos que não estiverem no banco de dados.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-gray-200 bg-white shadow-xs hover:border-[#5A5A40]/30 transition-colors">
                  <span className="font-bold text-xs text-[#5A5A40] block mb-1">🔍 Pesquisa e Filtros Integrados</span>
                  <p className="text-[11px] text-gray-500 leading-normal">
                    Filtre sua fila de análises por <b>Posto de Atendimento (PAC)</b>, <b>Status do Lote</b>, busque digitações rápidas no campo de busca abrangente ou defina um intervalo de datas para focar apenas nas remessas desejadas.
                  </p>
                </div>
              </div>

              {/* Interactive Mock Screen Representation */}
              <div className="mt-6 border border-gray-200 rounded-3xl overflow-hidden bg-[#fafafa] shadow-inner">
                <div className="bg-[#f0f0ea] px-4 py-2 border-b border-gray-200 flex items-center justify-between text-[11px] font-bold text-[#5A5A40]">
                  <span className="flex items-center gap-1.5"><LayoutDashboard size={12} /> Representação Visual: Formulário de Lote</span>
                  <span className="bg-white/70 px-2 py-0.5 rounded text-[9px]">MOCKUP DE TELA</span>
                </div>
                <div className="p-6 space-y-4 max-w-xl mx-auto">
                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b">
                      <h4 className="text-xs font-bold text-[#5A5A40]">Informações do Lote de Ensaio</h4>
                      <span className="text-[9px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full">Pendente</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[10px]">
                      <div>
                        <label className="block text-gray-400 font-bold mb-1">PERÍODO INICIAL</label>
                        <div className="p-2 border rounded-lg bg-gray-50 font-mono text-gray-700">01/05/2026</div>
                      </div>
                      <div>
                        <label className="block text-gray-400 font-bold mb-1">PERÍODO FINAL</label>
                        <div className="p-2 border rounded-lg bg-gray-50 font-mono text-gray-700">31/05/2026</div>
                      </div>
                    </div>

                    <div className="text-[10px]">
                      <label className="block text-gray-400 font-bold mb-1">POSTO DE ATENDIMENTO (PAC)</label>
                      <div className="p-2 border rounded-lg bg-gray-50 text-gray-700 font-semibold">PAC CURITIBA - SEDE CENTRAL</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[10px]">
                      <div>
                        <label className="block text-gray-400 font-bold mb-1">Nº DE ENSAIOS</label>
                        <div className="p-2 border rounded-lg bg-gray-50 font-mono text-gray-700">142</div>
                      </div>
                      <div className="flex items-center pt-5">
                        <div className="flex items-center gap-2 text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl font-bold w-full justify-center">
                          <input type="checkbox" checked disabled className="accent-amber-600" />
                          <span>Fora do Prazo ⚠️</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: STATS */}
          {activeSection === 'stats' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                <BarChart3 className="text-[#5A5A40] w-6 h-6" />
                <h3 className="text-lg font-bold text-gray-900">Estatísticas de Conformidades e Desempenho</h3>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                Este módulo compila todas as informações cadastradas de lotes para estruturar gráficos analíticos e painéis informativos para tomadas de decisão regulatórias dos administradores do IPEM-PR.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-xs">
                  <div className="text-2xl font-black text-red-650">94.8%</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Índice Geral de Conformidade</div>
                  <p className="text-[10px] text-gray-500 leading-snug mt-1">
                    Percentual de ensaios cujas placas obtiveram o status regular de aprovação sem desvios graves de leitura.
                  </p>
                </div>

                <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-xs">
                  <div className="text-2xl font-black text-amber-650">26 Lotes</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Entregas Fora do Prazo</div>
                  <p className="text-[10px] text-gray-500 leading-snug mt-1">
                    O número total de remessas marcadas com revalidação de entrega tardia para notificações administrativas.
                  </p>
                </div>

                <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-xs">
                  <div className="text-2xl font-black text-blue-650">14 PACs</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Monitorados Ativos</div>
                  <p className="text-[10px] text-gray-500 leading-snug mt-1">
                    Postos de Atendimento ao Consumidor cadastrados e enviando relatórios periódicos de fiscalização.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-4">
                <h4 className="text-xs font-bold text-gray-700">Metodologia de Gráficos Integrados</h4>
                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex items-start gap-2">
                    <CheckCircle size={15} className="text-green-600 shrink-0 mt-0.5" />
                    <span><b>Volume Geral por PAC</b>: Compara instantaneamente os postos de maior produtividade com os que registram mais não-conformidades técnicas.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle size={15} className="text-green-600 shrink-0 mt-0.5" />
                    <span><b>Evolução Histórica Mensal</b>: Curva flutuante demonstrando a redução ou aumento na taxa de erro nas placas que compõem o sistema estadual.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: NOTIFICATIONS */}
          {activeSection === 'notifications' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                <Bell className="text-[#5A5A40] w-6 h-6" />
                <h3 className="text-lg font-bold text-gray-900">Gerenciador de Ofícios & Notificações</h3>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                As irregularidades salvas no banco de dados alimentam automaticamente o gerador de documentos oficiais do IPEM-PR. Ao navegar por este módulo, o sistema analisa os desvios de ensaio para estruturar ofícios de retificação ou notificações formais em padrão institucional.
              </p>

              <div className="bg-[#FFFDF5] border border-amber-200 rounded-2xl p-4.5 text-xs text-amber-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-900 mb-1">
                  <Sparkles size={16} />
                  <span>Tratamento Automático de Ensaios Fora do Prazo</span>
                </div>
                <p className="leading-relaxed">
                  Sempre que um lote possui a marcação <b>"ensaio entregue fora do prazo"</b> ativada, a notificação gerada incluirá de forma complementar um item contendo o detalhamento completo dos prazos descumpridos:
                </p>
                <div className="bg-white/80 border border-amber-100 rounded-lg p-3 font-mono text-[10px] text-amber-900 space-y-1 mt-1">
                  <div>• <b>Identificação Temporal</b>: Período Inicial e Período Final do lote correspondente.</div>
                  <div>• <b>Contagem de Volume</b>: O total de ensaios afetados pelo atraso na entrega.</div>
                  <div>• <b>Enquadramento Específico</b>: Detalhado nas fundamentações jurídicas ou instruções normativas associadas ao modelo do ofício.</div>
                </div>
              </div>

              {/* NEW FEATURES HIGHLIGHT */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 text-emerald-950 text-xs space-y-1">
                  <span className="font-bold text-emerald-800 block">🛡️ Filtro de Visibilidade de PACs</span>
                  <p className="text-[11px] text-emerald-900/80 leading-relaxed">
                    A tela de <b>PACs Pendentes</b> agora exibe apenas os postos com alta criticidade: lotes que atingiram <b>mais de 10% de não-conformidades</b> ou que contam com <b>atraso de entrega</b>. Isso mantém a mesa limpa e focada.
                  </p>
                </div>
                <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 text-emerald-950 text-xs space-y-1">
                  <span className="font-bold text-emerald-800 block">📝 Registro de Defesas</span>
                  <p className="text-[11px] text-emerald-900/80 leading-relaxed">
                    Ao mudar a Situação da Defesa para <b>"Defesa Recebida"</b>, o sistema abre um formulário dedicado para colar ou redigir a contestação oficial recebida. Esse texto fica salvo e visível no histórico de cada notificação.
                  </p>
                </div>
                <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 text-emerald-950 text-xs space-y-1">
                  <span className="font-bold text-emerald-800 block">🔍 Filtros & Histórico Avançado</span>
                  <p className="text-[11px] text-emerald-900/80 leading-relaxed">
                    A Central de Notificações Enviadas conta agora com filtros dinâmicos de <b>Situação</b> (Defesa Recebida, Aguardando, Retificada), de <b>Tipo de Ofício</b>, ordenação cronológica/alfabética e busca rápida de texto que pesquisa inclusive no conteúdo das defesas.
                  </p>
                </div>
              </div>

              <div className="space-y-3.5">
                <h4 className="text-xs font-bold text-gray-800">Passo a Passo para Notificar um Posto (PAC):</h4>
                <ol className="space-y-2 text-xs text-gray-600 list-decimal pl-4.5">
                  <li>Navegue até a aba <b>"Notificações"</b>;</li>
                  <li>O sistema exibirá a lista de postos que possuem irregularidades detectadas (Placas não-conformes ou Ensaios com entrega atrasada);</li>
                  <li>Clique no botão <b>"Processar Ofício"</b> ao lado do PAC correspondente;</li>
                  <li>Escolha o <b>Modelo de Ofício / Tipo de Notificação</b> aplicável (personalizado nas configurações);</li>
                  <li>Visualize o rascunho completo do cabeçalho oficial do IPEM-PR integrado ao endereço, assinaturas configuradas, CNPJ do posto, e listas automáticas de problemas;</li>
                  <li>Clique em <b>"Gerar e Salvar Notificação"</b> para formalizar e registrar o histórico e imprimir o PDF.</li>
                </ol>
              </div>

              {/* Mock visual preview of notification */}
              <div className="mt-4 border border-gray-200 rounded-3xl overflow-hidden bg-white shadow-sm font-sans">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-250 flex items-center justify-between text-[11px] font-bold text-gray-600">
                  <span className="flex items-center gap-1.5"><FileText size={12} /> Exemplo de Ofício de Notificação</span>
                  <span className="text-[9px] uppercase tracking-wider bg-gray-250 px-2.5 py-0.5 rounded text-gray-800 font-bold">Oficial IPEM</span>
                </div>
                <div className="p-6 space-y-4 max-w-2xl mx-auto border-x border-b border-gray-50 shadow-inner">
                  <div className="text-center font-bold text-[#5A5A40] border-b pb-4">
                    <div className="text-lg uppercase tracking-wide">ESTADO DO PARANÁ</div>
                    <div className="text-xs font-semibold text-gray-400 font-mono mt-0.5">INSTITUTO DE PESOS E MEDIDAS DO PARANÁ - IPEM-PR</div>
                  </div>

                  <div className="text-[11px] text-gray-700 leading-relaxed space-y-2.5">
                    <p className="font-bold">Ofício nº 42/2026-IPEM/PRESI</p>
                    <p className="text-right italic text-gray-500">Curitiba, 19 de Junho de 2026.</p>
                    
                    <p className="font-bold text-gray-900 mt-2">Ao Posto de Atendimento - PAC CASCAVEL</p>
                    
                    <p className="text-justify leading-relaxed">
                      Prezado Senhor Administrador, solicitamos providências imediatas quanto às seguintes irregularidades identificadas na avaliação de ensaios fiscalizados por este Instituto:
                    </p>

                    <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200/50 space-y-1.5 mt-2">
                      <div className="font-bold text-amber-950 flex items-center gap-1.5">
                        <AlertCircle size={12} className="text-amber-700" />
                        <span>Desvio 01: Atraso Sistemático na Remessa Laboratorial</span>
                      </div>
                      <p className="text-[10px] text-amber-900 font-mono pl-5">
                        Fica registrado o descumprimento de prazos no <b>Período: 01/04/2026 a 30/04/2026</b> correspondente ao total de <b>185 ensaios</b> cuja entrega ocorreu fora das margens regimentais de conformidade administrativa.
                      </p>
                    </div>

                    <div className="pt-6 text-center space-y-1 max-w-xs mx-auto">
                      <div className="border-t border-gray-300 pt-1 font-bold text-gray-850 uppercase text-[10px]">DIRETORIA DE METROLOGIA E FISCALIZAÇÃO</div>
                      <div className="text-[9px] text-gray-500 italic">IPEM-PR</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: CONFIG */}
          {activeSection === 'config' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                <Settings2 className="text-[#5A5A40] w-6 h-6" />
                <h3 className="text-lg font-bold text-gray-900">Configurações & Cadastros Administrativos</h3>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                Este centro de controle permite que você configure as tabelas mestras que dão funcionamento automotivo ao sistema. São compostos por cadastros de PACs, lista de Colaboradores credenciados, Status dos Lotes, Motivos de Não-Conformidade, Tipos de Ofícios/Modelos e Enquadramentos Regulatórios aplicáveis.
              </p>

              {/* Highlight of alphabet ordering and search */}
              <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-blue-800">
                  <CheckCircle size={16} />
                  <span>Organização Sistemática por Ordem Alfabética & Pesquisa Avançada</span>
                </div>
                <p className="leading-relaxed">
                  Para simplificar e otimizar pesquisas em postos e na fiscalização regulatória:
                </p>
                <ul className="list-disc pl-4.5 space-y-1">
                  <li><b>Filtro de Busca Inteligente</b>: O menu <b>"Gerenciar Motivos de Não-Conformidade"</b> conta com um campo de buscas textuais de texto parcial. Digite qualquer termo, enenquadramento ou palavra-chave para encontrar instantaneamente o registro correspondente.</li>
                  <li><b>Ordenação Alfabética Automática</b>: Tanto a lista de Motivos de Não-Conformidades quanto os Enquadramentos Regulatórios são agora indexados e visualizados em rigorosa <b>ordem alfabética / sequencial crescente</b> por padrão para evitar desorganização visual.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-800">Submódulos de Configurações:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl border bg-[#fafafa]">
                    <span className="font-bold text-[#5A5A40] block mb-1">⚖️ Enquadramentos Regulatórios</span>
                    <p className="text-[11px] text-[#606045] leading-relaxed">
                      Gerencie as leis, portarias, e artigos do INMETRO / IPEM que tipificam penalidades regulamentares. Defina o número (Ex: "Art. 5º IPEM") e a descrição exata aplicadas no documento.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border bg-[#fafafa]">
                    <span className="font-bold text-[#5A5A40] block mb-1">🛠️ Motivos de Não-Conformidade</span>
                    <p className="text-[11px] text-[#606045] leading-relaxed">
                      Vincule comportamentos de placas não-conformes diretamente a enquadramentos regulatórios préinstanciados, simplificando o processo de imputação de sanções na emissão das notificações.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border bg-[#fafafa]">
                    <span className="font-bold text-[#5A5A40] block mb-1">🎨 Customização de Marca (Logotipo)</span>
                    <p className="text-[11px] text-[#606045] leading-relaxed">
                      Insira uma URL de logomarca institucional ou faça upload do brasão do IPEM-PR para sobrepor o cabeçalho de todos os PDFs gerados.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border bg-[#fafafa]">
                    <span className="font-bold text-[#5A5A40] block mb-1">🖋️ Assinaturas Responsáveis</span>
                    <p className="text-[11px] text-[#606045] leading-relaxed">
                      Registre assinaturas e rubricas eletrônicas de diretores e servidores de plantão responsáveis com cargo e link do selo para assinatura automatizada e segura de todos os ofícios.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: STORAGE */}
          {activeSection === 'storage' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                <Database className="text-[#5A5A40] w-6 h-6" />
                <h3 className="text-lg font-bold text-gray-900">Modo de Conexão na Nuvem vs Armazenamento Local</h3>
              </div>

              <p className="text-xs text-gray-650 leading-relaxed">
                Este sistema foi planejado com arquitetura dual-engine resiliente, permitindo total funcionalidade mesmo sob indisponibilidades do servidor remoto. Compreenda as duas dinâmicas operacionais:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-gray-150 bg-[#F4FDF9]">
                  <span className="font-bold text-xs text-green-800 block mb-1">🌐 Modo Nuvem (Firebase Firestore)</span>
                  <p className="text-[11px] text-green-900/80 leading-relaxed font-medium">
                    Adequado por padrão. Todas as suas tabelas de Lotes, Configurações de PACs, Histórico de Notificações enviadas e Logomarcas são salvas diretamente nos servidores da Cloud Run e do Firebase do IPEM-PR para compilar estatísticas em tempo real entre todos os colaboradores de forma síncrona.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-gray-150 bg-[#FFFDF5]">
                  <span className="font-bold text-xs text-amber-800 block mb-1">💾 Modo Armazenamento Local Inteligente</span>
                  <p className="text-[11px] text-amber-900/80 leading-relaxed font-medium">
                    Ativado automaticamente se a cota do plano gratuito do database expirar ou quando o usuário assim desejar via chave seletora. Seus dados são criptografados e salvos no cache (LocalStorage) do seu próprio navegador. Permite continuidade total do expediente com zero perdas de desempenho.
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 rounded-2xl border border-amber-250/60 p-4.5 flex gap-3 text-xs leading-normal text-amber-950">
                <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-900">Recuperação e Detecção Proativa de Erros</h4>
                  <p className="mt-1">
                    Caso ocorra qualquer erro de conexão com os servidores na nuvem (por exemplo, encerramento de cotas de acesso gratuitas diárias), uma caixa de alerta diferenciada amarela guiará o usuário a migrar temporariamente para o <b>Modo Local Inteligente</b> com apenas um clique, reestruturando suas rotinas operacionais sem paralisação do trabalho.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
