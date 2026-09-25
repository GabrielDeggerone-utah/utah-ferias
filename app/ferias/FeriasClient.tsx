'use client'
import { useState } from 'react'
import Layout from '@/components/Layout'

type Funcionario = { id: string; nome: string; data_admissao: string; cargo: string | null; ativo: boolean }
type Periodo = { id: string; funcionario_id: string; ano: number; dias_direito: number; observacao: string | null }
type Uso = { id: string; funcionario_id: string; data_inicio: string; data_fim: string; dias_uteis: number; observacao: string | null }

type Props = {
  email: string
  funcionarios: Funcionario[]
  periodos: Periodo[]
  usos: Uso[]
}

function calcDiasUteis(inicio: string, fim: string): number {
  const start = new Date(inicio + 'T12:00:00')
  const end = new Date(fim + 'T12:00:00')
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

function calcSaldo(fid: string, periodos: Periodo[], usos: Uso[]) {
  const totalDireito = periodos.filter(p => p.funcionario_id === fid).reduce((s, p) => s + p.dias_direito, 0)
  const totalUsado = usos.filter(u => u.funcionario_id === fid).reduce((s, u) => s + u.dias_uteis, 0)
  return { totalDireito, totalUsado, saldo: totalDireito - totalUsado }
}

function fmtDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export default function FeriasClient({ email, funcionarios: fInit, periodos: pInit, usos: uInit }: Props) {
  const [tab, setTab] = useState<'saldos' | 'registrar' | 'funcionarios'>('saldos')
  const [funcionarios, setFuncionarios] = useState(fInit)
  const [periodos, setPeriodos] = useState(pInit)
  const [usos, setUsos] = useState(uInit)

  // ── Novo funcionário ──────────────────────────────────────────────────────
  const [novoFunc, setNovoFunc] = useState({ nome: '', data_admissao: '', cargo: '' })
  const [loadingFunc, setLoadingFunc] = useState(false)
  const [erroFunc, setErroFunc] = useState('')
  const [sucessoFunc, setSucessoFunc] = useState('')

  async function criarFuncionario(e: React.FormEvent) {
    e.preventDefault()
    setErroFunc(''); setSucessoFunc(''); setLoadingFunc(true)
    const res = await fetch('/api/funcionarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoFunc),
    })
    const data = await res.json()
    setLoadingFunc(false)
    if (!res.ok) { setErroFunc(data.error || 'Erro ao cadastrar'); return }
    setSucessoFunc(`"${novoFunc.nome}" cadastrado!`)
    setFuncionarios(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)))
    setNovoFunc({ nome: '', data_admissao: '', cargo: '' })
  }

  async function toggleAtivo(f: Funcionario) {
    await fetch('/api/funcionarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: f.id, ativo: !f.ativo }),
    })
    setFuncionarios(prev => prev.map(x => x.id === f.id ? { ...x, ativo: !x.ativo } : x))
  }

  // ── Período de direito ────────────────────────────────────────────────────
  const [novoPeriodo, setNovoPeriodo] = useState({ funcionario_id: '', ano: new Date().getFullYear(), dias_direito: 30, observacao: '' })
  const [loadingPer, setLoadingPer] = useState(false)
  const [erroPer, setErroPer] = useState('')
  const [sucessoPer, setSucessoPer] = useState('')

  async function salvarPeriodo(e: React.FormEvent) {
    e.preventDefault()
    setErroPer(''); setSucessoPer(''); setLoadingPer(true)
    const res = await fetch('/api/ferias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'periodo', ...novoPeriodo }),
    })
    const data = await res.json()
    setLoadingPer(false)
    if (!res.ok) { setErroPer(data.error || 'Erro'); return }
    setSucessoPer('Período salvo!')
    setPeriodos(prev => {
      const sem = prev.filter(p => !(p.funcionario_id === data.funcionario_id && p.ano === data.ano))
      return [...sem, data].sort((a, b) => a.ano - b.ano)
    })
  }

  async function deletarPeriodo(id: string) {
    if (!confirm('Remover este período?')) return
    await fetch('/api/ferias', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, tipo: 'periodo' }),
    })
    setPeriodos(prev => prev.filter(p => p.id !== id))
  }

  // ── Uso de férias ─────────────────────────────────────────────────────────
  const [novoUso, setNovoUso] = useState({ funcionario_id: '', data_inicio: '', data_fim: '', observacao: '' })
  const [loadingUso, setLoadingUso] = useState(false)
  const [erroUso, setErroUso] = useState('')
  const [sucessoUso, setSucessoUso] = useState('')

  const diasUteisCalc = novoUso.data_inicio && novoUso.data_fim && novoUso.data_fim >= novoUso.data_inicio
    ? calcDiasUteis(novoUso.data_inicio, novoUso.data_fim)
    : 0

  async function registrarUso(e: React.FormEvent) {
    e.preventDefault()
    setErroUso(''); setSucessoUso(''); setLoadingUso(true)
    const res = await fetch('/api/ferias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'uso', ...novoUso, dias_uteis: diasUteisCalc }),
    })
    const data = await res.json()
    setLoadingUso(false)
    if (!res.ok) { setErroUso(data.error || 'Erro'); return }
    const func = funcionarios.find(f => f.id === novoUso.funcionario_id)
    setSucessoUso(`Férias de ${func?.nome} registradas (${diasUteisCalc} dias úteis)`)
    setUsos(prev => [data, ...prev])
    setNovoUso(prev => ({ ...prev, data_inicio: '', data_fim: '', observacao: '' }))
  }

  async function deletarUso(id: string) {
    if (!confirm('Remover este registro?')) return
    await fetch('/api/ferias', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, tipo: 'uso' }),
    })
    setUsos(prev => prev.filter(u => u.id !== id))
  }

  const funcAtivos = funcionarios.filter(f => f.ativo)

  return (
    <Layout email={email}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-gray-900">Controle de Férias</h1>
          <p className="text-sm text-gray-500">Escritório Utah Invest — somente dias úteis</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {([
            { key: 'saldos', label: 'Saldos' },
            { key: 'registrar', label: 'Registrar férias' },
            { key: 'funcionarios', label: 'Funcionários' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-utah-500 text-utah-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB: Saldos ─────────────────────────────────────────────────── */}
        {tab === 'saldos' && (
          <div className="space-y-4">
            {funcAtivos.length === 0 && (
              <div className="card p-8 text-center text-gray-400 text-sm">
                Nenhum funcionário cadastrado. Vá em <button className="text-utah-500 underline" onClick={() => setTab('funcionarios')}>Funcionários</button> para começar.
              </div>
            )}
            {funcAtivos.map(f => {
              const { totalDireito, totalUsado, saldo } = calcSaldo(f.id, periodos, usos)
              const persFuncionario = periodos.filter(p => p.funcionario_id === f.id).sort((a, b) => a.ano - b.ano)
              const usosFuncionario = usos.filter(u => u.funcionario_id === f.id)

              return (
                <div key={f.id} className="card p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-semibold text-gray-900">{f.nome}</p>
                      <p className="text-xs text-gray-400">{f.cargo || 'Sem cargo'} · Admissão: {fmtDate(f.data_admissao)}</p>
                    </div>
                    <div className="flex gap-6 text-sm">
                      <div className="text-center">
                        <p className="text-xs text-gray-400 mb-0.5">Direito acumulado</p>
                        <p className="font-semibold text-gray-700">{totalDireito} dias</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-400 mb-0.5">Usados</p>
                        <p className="font-semibold text-orange-600">{totalUsado} dias</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-400 mb-0.5">Saldo</p>
                        <p className={`font-bold text-lg leading-tight ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>{saldo}d</p>
                      </div>
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  {totalDireito > 0 && (
                    <div className="mb-4">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-400 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (totalUsado / totalDireito) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{Math.round((totalUsado / totalDireito) * 100)}% dos dias acumulados utilizados</p>
                    </div>
                  )}

                  {/* Períodos de direito */}
                  {persFuncionario.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-500 mb-1.5">Dias de direito por ano</p>
                      <div className="flex flex-wrap gap-2">
                        {persFuncionario.map(p => (
                          <div key={p.id} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full">
                            <span>{p.ano}: {p.dias_direito}d</span>
                            <button onClick={() => deletarPeriodo(p.id)} className="text-blue-300 hover:text-blue-600">✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Histórico de usos */}
                  {usosFuncionario.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1.5">Férias registradas</p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400">
                            <th className="text-left pb-1 font-normal">Início</th>
                            <th className="text-left pb-1 font-normal">Fim</th>
                            <th className="text-left pb-1 font-normal">Dias úteis</th>
                            <th className="text-left pb-1 font-normal">Obs.</th>
                            <th className="pb-1" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {usosFuncionario.map(u => (
                            <tr key={u.id}>
                              <td className="py-1.5 text-gray-700">{fmtDate(u.data_inicio)}</td>
                              <td className="py-1.5 text-gray-700">{fmtDate(u.data_fim)}</td>
                              <td className="py-1.5 font-medium text-orange-600">{u.dias_uteis}d úteis</td>
                              <td className="py-1.5 text-gray-400">{u.observacao || '—'}</td>
                              <td className="py-1.5 text-right">
                                <button onClick={() => deletarUso(u.id)} className="text-red-300 hover:text-red-500">✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {persFuncionario.length === 0 && usosFuncionario.length === 0 && (
                    <p className="text-xs text-gray-400">Sem registros ainda.</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── TAB: Registrar ──────────────────────────────────────────────── */}
        {tab === 'registrar' && (
          <div className="space-y-6">
            {/* Adicionar período de direito */}
            <div className="card p-6">
              <p className="text-sm font-medium text-gray-700 mb-1">Adicionar dias de direito por ano</p>
              <p className="text-xs text-gray-400 mb-4">Defina quantos dias cada funcionário tem direito em cada ano. Os dias se acumulam.</p>
              {erroPer && <div className="mb-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-4 py-3">{erroPer}</div>}
              {sucessoPer && <div className="mb-4 bg-green-50 border border-green-100 text-green-800 text-sm rounded-lg px-4 py-3">{sucessoPer}</div>}
              <form onSubmit={salvarPeriodo} className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Funcionário *</label>
                  <select className="input" value={novoPeriodo.funcionario_id} onChange={e => setNovoPeriodo(p => ({ ...p, funcionario_id: e.target.value }))} required>
                    <option value="">Selecione...</option>
                    {funcAtivos.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Ano *</label>
                  <input className="input" type="number" min="2000" max="2100" value={novoPeriodo.ano}
                    onChange={e => setNovoPeriodo(p => ({ ...p, ano: Number(e.target.value) }))} required />
                </div>
                <div>
                  <label className="label">Dias de direito *</label>
                  <input className="input" type="number" min="1" max="60" value={novoPeriodo.dias_direito}
                    onChange={e => setNovoPeriodo(p => ({ ...p, dias_direito: Number(e.target.value) }))} required />
                </div>
                <div>
                  <label className="label">Observação</label>
                  <input className="input" type="text" value={novoPeriodo.observacao}
                    onChange={e => setNovoPeriodo(p => ({ ...p, observacao: e.target.value }))} placeholder="Opcional" />
                </div>
                <div className="col-span-2 flex justify-end">
                  <button className="btn-secondary" type="submit" disabled={loadingPer}>
                    {loadingPer ? 'Salvando...' : 'Salvar período'}
                  </button>
                </div>
              </form>
            </div>

            {/* Registrar uso */}
            <div className="card p-6">
              <p className="text-sm font-medium text-gray-700 mb-1">Registrar férias usadas</p>
              <p className="text-xs text-gray-400 mb-4">Os dias úteis são calculados automaticamente (exclui sábados e domingos).</p>
              {erroUso && <div className="mb-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-4 py-3">{erroUso}</div>}
              {sucessoUso && <div className="mb-4 bg-green-50 border border-green-100 text-green-800 text-sm rounded-lg px-4 py-3">{sucessoUso}</div>}
              <form onSubmit={registrarUso} className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Funcionário *</label>
                  <select className="input" value={novoUso.funcionario_id} onChange={e => setNovoUso(p => ({ ...p, funcionario_id: e.target.value }))} required>
                    <option value="">Selecione...</option>
                    {funcAtivos.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Data início *</label>
                  <input className="input" type="date" value={novoUso.data_inicio}
                    onChange={e => setNovoUso(p => ({ ...p, data_inicio: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Data fim *</label>
                  <input className="input" type="date" value={novoUso.data_fim}
                    onChange={e => setNovoUso(p => ({ ...p, data_fim: e.target.value }))} required />
                </div>
                {diasUteisCalc > 0 && (
                  <div className="col-span-2">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-700">
                      <span className="font-semibold">{diasUteisCalc} dias úteis</span> no período selecionado
                    </div>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="label">Observação</label>
                  <input className="input" type="text" value={novoUso.observacao}
                    onChange={e => setNovoUso(p => ({ ...p, observacao: e.target.value }))} placeholder="Opcional" />
                </div>
                <div className="col-span-2 flex justify-end">
                  <button className="btn-primary" type="submit" disabled={loadingUso || diasUteisCalc === 0}>
                    {loadingUso ? 'Registrando...' : 'Registrar férias'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── TAB: Funcionários ───────────────────────────────────────────── */}
        {tab === 'funcionarios' && (
          <div>
            <div className="card p-6 mb-6">
              <p className="text-sm font-medium text-gray-700 mb-4">Novo funcionário</p>
              {erroFunc && <div className="mb-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-4 py-3">{erroFunc}</div>}
              {sucessoFunc && <div className="mb-4 bg-green-50 border border-green-100 text-green-800 text-sm rounded-lg px-4 py-3">{sucessoFunc}</div>}
              <form onSubmit={criarFuncionario} className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Nome *</label>
                  <input className="input" type="text" value={novoFunc.nome}
                    onChange={e => setNovoFunc(p => ({ ...p, nome: e.target.value }))} required placeholder="Nome completo" />
                </div>
                <div>
                  <label className="label">Data de admissão *</label>
                  <input className="input" type="date" value={novoFunc.data_admissao}
                    onChange={e => setNovoFunc(p => ({ ...p, data_admissao: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Cargo</label>
                  <input className="input" type="text" value={novoFunc.cargo}
                    onChange={e => setNovoFunc(p => ({ ...p, cargo: e.target.value }))} placeholder="Ex: Secretária" />
                </div>
                <div className="col-span-3 flex justify-end">
                  <button className="btn-primary" type="submit" disabled={loadingFunc}>
                    {loadingFunc ? 'Cadastrando...' : 'Cadastrar'}
                  </button>
                </div>
              </form>
            </div>

            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Nome</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Cargo</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Admissão</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Saldo atual</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {funcionarios.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400">Nenhum funcionário cadastrado.</td></tr>
                  )}
                  {funcionarios.map(f => {
                    const { saldo } = calcSaldo(f.id, periodos, usos)
                    return (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{f.nome}</td>
                        <td className="px-4 py-3 text-gray-500">{f.cargo || '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(f.data_admissao)}</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>{saldo}d</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${f.ativo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {f.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => toggleAtivo(f)} className={`text-xs ${f.ativo ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}>
                            {f.ativo ? 'Desativar' : 'Ativar'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
