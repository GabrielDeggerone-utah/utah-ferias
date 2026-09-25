'use client'
import { useState } from 'react'
import Layout from '@/components/Layout'

type Funcionario = { id: string; nome: string; data_admissao: string; cargo: string | null; ativo: boolean }
type Uso = { id: string; funcionario_id: string; data_inicio: string; data_fim: string; dias_uteis: number; observacao: string | null; created_at: string }

type Props = {
  email: string
  funcionarios: Funcionario[]
  usos: Uso[]
}

const DIAS_POR_ANO = 20

// Calcula dias acumulados automaticamente:
// +20 dias a cada ano a partir do 1º aniversário de admissão (mesmo mês)
function calcDiasAcumulados(dataAdmissao: string): { total: number; renovacoes: { ano: number; mes: number; data: string }[] } {
  const admissao = new Date(dataAdmissao + 'T12:00:00')
  const hoje = new Date()
  const renovacoes: { ano: number; mes: number; data: string }[] = []

  let proxRenovacao = new Date(admissao)
  proxRenovacao.setFullYear(proxRenovacao.getFullYear() + 1)

  while (proxRenovacao <= hoje) {
    if (proxRenovacao.getFullYear() >= 2025) {
      renovacoes.push({
        ano: proxRenovacao.getFullYear(),
        mes: proxRenovacao.getMonth() + 1,
        data: proxRenovacao.toISOString().split('T')[0],
      })
    }
    proxRenovacao = new Date(proxRenovacao)
    proxRenovacao.setFullYear(proxRenovacao.getFullYear() + 1)
  }

  return { total: renovacoes.length * DIAS_POR_ANO, renovacoes }
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

function fmtDate(d: string) {
  if (!d) return ''
  const part = d.split('T')[0]
  const [y, m, day] = part.split('-')
  return `${day}/${m}/${y}`
}

function getAno(d: string) { return d.split('T')[0].split('-')[0] }
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
function fmtMesAno(d: string) {
  const [,m] = d.split('T')[0].split('-')
  return MESES[parseInt(m) - 1]
}

const CORES = ['bg-blue-500','bg-purple-500','bg-green-500','bg-orange-500','bg-pink-500','bg-teal-500','bg-indigo-500','bg-red-500']

export default function FeriasClient({ email, funcionarios: fInit, usos: uInit }: Props) {
  const [tab, setTab] = useState<'saldos' | 'historico' | 'registrar' | 'funcionarios'>('saldos')
  const [funcionarios, setFuncionarios] = useState(fInit)
  const [usos, setUsos] = useState(uInit)

  const funcAtivos = funcionarios.filter(f => f.ativo)
  const coresPorFuncionario: Record<string, string> = {}
  funcAtivos.forEach((f, i) => { coresPorFuncionario[f.id] = CORES[i % CORES.length] })

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

  return (
    <Layout email={email}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-gray-900">Controle de Férias</h1>
          <p className="text-sm text-gray-500">Escritório Utah Invest — somente dias úteis · +{DIAS_POR_ANO}d por ano no mês de admissão</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {([
            { key: 'saldos', label: 'Saldos' },
            { key: 'historico', label: 'Histórico' },
            { key: 'registrar', label: 'Registrar férias' },
            { key: 'funcionarios', label: 'Funcionários' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-utah-500 text-utah-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
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
              const { total: totalDireito, renovacoes } = calcDiasAcumulados(f.data_admissao)
              const totalUsado = usos.filter(u => u.funcionario_id === f.id).reduce((s, u) => s + u.dias_uteis, 0)
              const saldo = totalDireito - totalUsado
              const pct = totalDireito > 0 ? Math.min(100, Math.round((totalUsado / totalDireito) * 100)) : 0
              const cor = coresPorFuncionario[f.id]

              // Próxima renovação
              const admissao = new Date(f.data_admissao + 'T12:00:00')
              const proxRen = new Date(admissao)
              const hoje = new Date()
              proxRen.setFullYear(proxRen.getFullYear() + 1)
              while (proxRen <= hoje) proxRen.setFullYear(proxRen.getFullYear() + 1)

              return (
                <div key={f.id} className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full ${cor} flex items-center justify-center text-white text-sm font-semibold`}>
                        {f.nome.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{f.nome}</p>
                        <p className="text-xs text-gray-400">
                          {f.cargo || 'Sem cargo'} · desde {fmtDate(f.data_admissao)} · renova todo {MESES[admissao.getMonth()]}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-6 text-center">
                      <div>
                        <p className="text-xs text-gray-400">Acumulado</p>
                        <p className="font-semibold text-gray-700 text-lg">{totalDireito}d</p>
                        <p className="text-xs text-gray-400">{renovacoes.length} renov.</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Usados</p>
                        <p className="font-semibold text-orange-500 text-lg">{totalUsado}d</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Saldo</p>
                        <p className={`font-bold text-lg ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>{saldo}d</p>
                      </div>
                    </div>
                  </div>

                  {/* Barra */}
                  {totalDireito > 0 ? (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{pct}% utilizado</span>
                        <span>Próxima renovação: {fmtDate(proxRen.toISOString().split('T')[0])} (+{DIAS_POR_ANO}d)</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-400' : pct >= 75 ? 'bg-orange-400' : 'bg-green-400'}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                      Ainda sem dias acumulados — primeira renovação em {fmtDate(proxRen.toISOString().split('T')[0])}
                    </div>
                  )}

                  {/* Renovações passadas */}
                  {renovacoes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {renovacoes.map(r => (
                        <span key={r.data} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                          {MESES[r.mes - 1]}/{r.ano} +{DIAS_POR_ANO}d
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── TAB: Histórico ──────────────────────────────────────────────── */}
        {tab === 'historico' && (
          <div className="space-y-6">
            {funcAtivos.length === 0 && (
              <div className="card p-8 text-center text-gray-400 text-sm">Nenhum funcionário cadastrado.</div>
            )}
            {funcAtivos.map(f => {
              const usosFuncionario = usos.filter(u => u.funcionario_id === f.id)
                .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))
              const porAno: Record<string, Uso[]> = {}
              usosFuncionario.forEach(u => {
                const ano = getAno(u.data_inicio)
                if (!porAno[ano]) porAno[ano] = []
                porAno[ano].push(u)
              })
              const anos = Object.keys(porAno).sort((a, b) => b.localeCompare(a))
              const cor = coresPorFuncionario[f.id]
              const { total: totalDireito } = calcDiasAcumulados(f.data_admissao)
              const totalUsado = usosFuncionario.reduce((s, u) => s + u.dias_uteis, 0)

              return (
                <div key={f.id} className="card overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${cor} flex items-center justify-center text-white text-sm font-semibold`}>
                        {f.nome.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{f.nome}</p>
                        <p className="text-xs text-gray-500">{f.cargo || 'Sem cargo'}</p>
                      </div>
                    </div>
                    <div className="flex gap-4 text-right text-sm">
                      <div>
                        <p className="text-xs text-gray-400">Acumulado</p>
                        <p className="font-semibold text-gray-700">{totalDireito}d</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Usados</p>
                        <p className="font-semibold text-orange-500">{totalUsado}d</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Saldo</p>
                        <p className={`font-bold ${totalDireito - totalUsado >= 0 ? 'text-green-600' : 'text-red-600'}`}>{totalDireito - totalUsado}d</p>
                      </div>
                    </div>
                  </div>

                  {usosFuncionario.length === 0 ? (
                    <div className="px-5 py-6 text-sm text-gray-400 text-center">Nenhum registro de férias ainda.</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {anos.map(ano => {
                        const usosAno = porAno[ano]
                        const totalAno = usosAno.reduce((s, u) => s + u.dias_uteis, 0)
                        return (
                          <div key={ano} className="px-5 py-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-semibold text-gray-700">{ano}</span>
                              <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                                {totalAno}d úteis usados
                              </span>
                            </div>
                            <div className="space-y-2">
                              {usosAno.map((u, i) => (
                                <div key={u.id} className="flex items-start gap-3 group">
                                  <div className="flex flex-col items-center mt-1.5">
                                    <div className={`w-2.5 h-2.5 rounded-full ${cor} flex-shrink-0`} />
                                    {i < usosAno.length - 1 && <div className="w-0.5 bg-gray-200 mt-1 min-h-[20px]" />}
                                  </div>
                                  <div className="flex-1 flex items-center justify-between pb-1">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-800 font-medium">
                                          {fmtDate(u.data_inicio)} → {fmtDate(u.data_fim)}
                                        </span>
                                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                          {fmtMesAno(u.data_inicio)}
                                        </span>
                                      </div>
                                      {u.observacao && <p className="text-xs text-gray-400 mt-0.5">{u.observacao}</p>}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-semibold text-orange-600">{u.dias_uteis}d úteis</span>
                                      <button onClick={() => deletarUso(u.id)}
                                        className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500 transition-opacity text-xs">✕</button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── TAB: Registrar ──────────────────────────────────────────────── */}
        {tab === 'registrar' && (
          <div className="card p-6">
            <p className="text-sm font-medium text-gray-700 mb-1">Registrar férias usadas</p>
            <p className="text-xs text-gray-400 mb-4">Dias úteis calculados automaticamente (exclui sábados e domingos).</p>
            {erroUso && <div className="mb-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-4 py-3">{erroUso}</div>}
            {sucessoUso && <div className="mb-4 bg-green-50 border border-green-100 text-green-800 text-sm rounded-lg px-4 py-3">{sucessoUso}</div>}
            <form onSubmit={registrarUso} className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Funcionário *</label>
                <select className="input" value={novoUso.funcionario_id} onChange={e => setNovoUso(p => ({ ...p, funcionario_id: e.target.value }))} required>
                  <option value="">Selecione...</option>
                  {funcAtivos.map(f => {
                    const { total } = calcDiasAcumulados(f.data_admissao)
                    const usado = usos.filter(u => u.funcionario_id === f.id).reduce((s, u) => s + u.dias_uteis, 0)
                    return <option key={f.id} value={f.id}>{f.nome} (saldo: {total - usado}d)</option>
                  })}
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
                <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-700">
                  <span className="font-semibold">{diasUteisCalc} dias úteis</span> no período selecionado
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
        )}

        {/* ── TAB: Funcionários ───────────────────────────────────────────── */}
        {tab === 'funcionarios' && (
          <div>
            <div className="card p-6 mb-6">
              <p className="text-sm font-medium text-gray-700 mb-1">Novo funcionário</p>
              <p className="text-xs text-gray-400 mb-4">
                Os dias de férias são acumulados automaticamente: +{DIAS_POR_ANO} dias úteis todo ano no mês de admissão, a partir do 1º aniversário.
              </p>
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
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Renova em</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Saldo</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {funcionarios.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-400">Nenhum funcionário cadastrado.</td></tr>
                  )}
                  {funcionarios.map(f => {
                    const { total } = calcDiasAcumulados(f.data_admissao)
                    const usado = usos.filter(u => u.funcionario_id === f.id).reduce((s, u) => s + u.dias_uteis, 0)
                    const saldo = total - usado
                    const admissao = new Date(f.data_admissao + 'T12:00:00')
                    const proxRen = new Date(admissao)
                    const hoje = new Date()
                    proxRen.setFullYear(proxRen.getFullYear() + 1)
                    while (proxRen <= hoje) proxRen.setFullYear(proxRen.getFullYear() + 1)

                    return (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full ${coresPorFuncionario[f.id] || 'bg-gray-300'} flex items-center justify-center text-white text-xs font-semibold`}>
                              {f.nome.charAt(0)}
                            </div>
                            <span className="font-medium text-gray-900">{f.nome}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{f.cargo || '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(f.data_admissao)}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(proxRen.toISOString().split('T')[0])}</td>
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
