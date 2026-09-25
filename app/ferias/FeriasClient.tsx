'use client'
import { useState } from 'react'
import Layout from '@/components/Layout'

type Funcionario = { id: string; nome: string; data_admissao: string; cargo: string | null; ativo: boolean; saldo_anterior: number }
type Uso = { id: string; funcionario_id: string; data_inicio: string; data_fim: string; dias_uteis: number; observacao: string | null; created_at: string; agendado: boolean }

type Props = { email: string; funcionarios: Funcionario[]; usos: Uso[] }

const DIAS_POR_ANO = 20
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const CORES = ['bg-blue-500','bg-purple-500','bg-green-500','bg-orange-500','bg-pink-500','bg-teal-500','bg-indigo-500','bg-red-500']

function calcDiasAcumulados(dataAdmissao: string) {
  const admissao = new Date(dataAdmissao + 'T12:00:00')
  const hoje = new Date()
  const renovacoes: { labelInicio: string; labelFim: string; credito: string }[] = []
  let prox = new Date(admissao)
  prox.setFullYear(prox.getFullYear() + 1)
  while (prox <= hoje) {
    const anoIni = prox.getFullYear() - 1
    const ini = new Date(prox); ini.setFullYear(anoIni)
    renovacoes.push({ labelInicio: `${MESES[ini.getMonth()]}/${anoIni}`, labelFim: `${MESES[prox.getMonth()]}/${prox.getFullYear()}`, credito: prox.toISOString().split('T')[0] })
    prox = new Date(prox); prox.setFullYear(prox.getFullYear() + 1)
  }
  return { total: renovacoes.length * DIAS_POR_ANO, renovacoes }
}

function calcDiasUteis(inicio: string, fim: string): number {
  const cur = new Date(inicio + 'T12:00:00'), end = new Date(fim + 'T12:00:00')
  let n = 0
  while (cur <= end) { const d = cur.getDay(); if (d !== 0 && d !== 6) n++; cur.setDate(cur.getDate() + 1) }
  return n
}

function fmtDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('T')[0].split('-')
  return `${day}/${m}/${y}`
}
function getAno(d: string) { return d.split('T')[0].split('-')[0] }
function fmtMesAno(d: string) { return MESES[parseInt(d.split('T')[0].split('-')[1]) - 1] }

function emFeriasHoje(usos: Uso[], fid: string): boolean {
  const hoje = new Date().toISOString().split('T')[0]
  return usos.some(u => u.funcionario_id === fid && u.agendado && u.data_inicio <= hoje && u.data_fim >= hoje)
}

export default function FeriasClient({ email, funcionarios: fInit, usos: uInit }: Props) {
  const [tab, setTab] = useState<'saldos'|'acumulado'|'agendado'|'historico'|'registrar'|'funcionarios'>('saldos')
  const [funcionarios, setFuncionarios] = useState(fInit)
  const [usos, setUsos] = useState(uInit)

  const funcAtivos = funcionarios.filter(f => f.ativo)
  const cores: Record<string, string> = {}
  funcAtivos.forEach((f, i) => { cores[f.id] = CORES[i % CORES.length] })

  function saldoFunc(f: Funcionario) {
    const { total } = calcDiasAcumulados(f.data_admissao)
    const totalDireito = total + (f.saldo_anterior ?? 0)
    const totalGasto = usos.filter(u => u.funcionario_id === f.id).reduce((s, u) => s + u.dias_uteis, 0)
    return { totalDireito, totalGasto, saldo: totalDireito - totalGasto }
  }

  // ── Funcionários ──────────────────────────────────────────────────────────
  const [novoFunc, setNovoFunc] = useState({ nome: '', data_admissao: '', cargo: '' })
  const [loadingFunc, setLoadingFunc] = useState(false)
  const [erroFunc, setErroFunc] = useState(''); const [okFunc, setOkFunc] = useState('')

  async function criarFuncionario(e: React.FormEvent) {
    e.preventDefault(); setErroFunc(''); setOkFunc(''); setLoadingFunc(true)
    const res = await fetch('/api/funcionarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novoFunc) })
    const data = await res.json(); setLoadingFunc(false)
    if (!res.ok) { setErroFunc(data.error || 'Erro'); return }
    setOkFunc(`"${novoFunc.nome}" cadastrado!`)
    setFuncionarios(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)))
    setNovoFunc({ nome: '', data_admissao: '', cargo: '' })
  }

  async function toggleAtivo(f: Funcionario) {
    await fetch('/api/funcionarios', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id, ativo: !f.ativo }) })
    setFuncionarios(prev => prev.map(x => x.id === f.id ? { ...x, ativo: !x.ativo } : x))
  }

  const [editSaldo, setEditSaldo] = useState<string|null>(null)
  const [saldoInputs, setSaldoInputs] = useState<Record<string,string>>({})

  async function salvarSaldoAnterior(f: Funcionario) {
    const val = parseInt(saldoInputs[f.id] ?? String(f.saldo_anterior), 10)
    if (isNaN(val)) return
    await fetch('/api/funcionarios', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id, saldo_anterior: val }) })
    setFuncionarios(prev => prev.map(x => x.id === f.id ? { ...x, saldo_anterior: val } : x))
    setEditSaldo(null)
  }

  async function deletarUso(id: string) {
    if (!confirm('Remover?')) return
    await fetch('/api/ferias', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, tipo: 'uso' }) })
    setUsos(prev => prev.filter(u => u.id !== id))
  }

  // ── Registrar uso ─────────────────────────────────────────────────────────
  const [novoUso, setNovoUso] = useState({ funcionario_id: '', dias: '', observacao: '' })
  const [loadingUso, setLoadingUso] = useState(false)
  const [erroUso, setErroUso] = useState(''); const [okUso, setOkUso] = useState('')

  async function registrarUso(e: React.FormEvent) {
    e.preventDefault()
    const dias = parseInt(novoUso.dias, 10)
    if (!dias || dias <= 0) return
    setErroUso(''); setOkUso(''); setLoadingUso(true)
    const hoje = new Date().toISOString().split('T')[0]
    const res = await fetch('/api/ferias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'uso', funcionario_id: novoUso.funcionario_id, data_inicio: hoje, data_fim: hoje, dias_uteis: dias, observacao: novoUso.observacao, agendado: false }) })
    const data = await res.json(); setLoadingUso(false)
    if (!res.ok) { setErroUso(data.error || 'Erro'); return }
    const func = funcionarios.find(f => f.id === novoUso.funcionario_id)
    setOkUso(`${dias} dias lançados para ${func?.nome}`)
    setUsos(prev => [data, ...prev])
    setNovoUso(prev => ({ ...prev, dias: '', observacao: '' }))
  }

  // ── Agendamento ───────────────────────────────────────────────────────────
  const [novoAgend, setNovoAgend] = useState({ funcionario_id: '', data_inicio: '', data_fim: '', observacao: '' })
  const [loadingAgend, setLoadingAgend] = useState(false)
  const [erroAgend, setErroAgend] = useState(''); const [okAgend, setOkAgend] = useState('')
  const [abrirAgend, setAbrirAgend] = useState<string|null>(null)

  const diasAgendCalc = novoAgend.data_inicio && novoAgend.data_fim && novoAgend.data_fim >= novoAgend.data_inicio
    ? calcDiasUteis(novoAgend.data_inicio, novoAgend.data_fim) : 0

  async function registrarAgend(e: React.FormEvent) {
    e.preventDefault()
    if (!diasAgendCalc) return
    setErroAgend(''); setOkAgend(''); setLoadingAgend(true)
    const res = await fetch('/api/ferias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'uso', funcionario_id: novoAgend.funcionario_id, data_inicio: novoAgend.data_inicio, data_fim: novoAgend.data_fim, dias_uteis: diasAgendCalc, observacao: novoAgend.observacao, agendado: true }) })
    const data = await res.json(); setLoadingAgend(false)
    if (!res.ok) { setErroAgend(data.error || 'Erro'); return }
    const func = funcionarios.find(f => f.id === novoAgend.funcionario_id)
    setOkAgend(`Agendado ${diasAgendCalc}d para ${func?.nome}`)
    setUsos(prev => [data, ...prev])
    setAbrirAgend(null)
    setNovoAgend(prev => ({ ...prev, data_inicio: '', data_fim: '', observacao: '' }))
  }

  const hoje = new Date().toISOString().split('T')[0]

  return (
    <Layout email={email}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-gray-900">Controle de Férias</h1>
          <p className="text-sm text-gray-500">Escritório Utah Invest — somente dias úteis · +{DIAS_POR_ANO}d por ano no mês de admissão</p>
        </div>

        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {([
            { key: 'saldos', label: 'Saldos' },
            { key: 'acumulado', label: 'Acumulado' },
            { key: 'agendado', label: 'Agendado' },
            { key: 'historico', label: 'Histórico' },
            { key: 'registrar', label: 'Registrar uso' },
            { key: 'funcionarios', label: 'Funcionários' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-utah-500 text-utah-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── SALDOS ────────────────────────────────────────────────────────── */}
        {tab === 'saldos' && (
          <div className="space-y-4">
            {funcAtivos.length === 0 && <div className="card p-8 text-center text-gray-400 text-sm">Nenhum funcionário cadastrado.</div>}
            {funcAtivos.map(f => {
              const { total, renovacoes } = calcDiasAcumulados(f.data_admissao)
              const totalDireito = total + (f.saldo_anterior ?? 0)
              const usados = usos.filter(u => u.funcionario_id === f.id && !u.agendado).reduce((s, u) => s + u.dias_uteis, 0)
              const agendados = usos.filter(u => u.funcionario_id === f.id && u.agendado).reduce((s, u) => s + u.dias_uteis, 0)
              const saldo = totalDireito - usados - agendados
              const pct = totalDireito > 0 ? Math.min(100, Math.round(((usados + agendados) / totalDireito) * 100)) : 0
              const cor = cores[f.id]
              const emFerias = emFeriasHoje(usos, f.id)
              const admissao = new Date(f.data_admissao + 'T12:00:00')
              const proxRen = new Date(admissao); const hojeD = new Date()
              proxRen.setFullYear(proxRen.getFullYear() + 1)
              while (proxRen <= hojeD) proxRen.setFullYear(proxRen.getFullYear() + 1)

              return (
                <div key={f.id} className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full ${cor} flex items-center justify-center text-white text-sm font-semibold`}>{f.nome.charAt(0)}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{f.nome}</p>
                          {emFerias && <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">EM PERÍODO DE FÉRIAS</span>}
                        </div>
                        <p className="text-xs text-gray-400">{f.cargo || 'Sem cargo'} · desde {fmtDate(f.data_admissao)} · renova {MESES[admissao.getMonth()]}</p>
                      </div>
                    </div>
                    <div className="flex gap-5 text-center">
                      <div><p className="text-xs text-gray-400">Acumulado</p><p className="font-semibold text-gray-700 text-lg">{totalDireito}d</p></div>
                      <div><p className="text-xs text-gray-400">Usados</p><p className="font-semibold text-orange-500 text-lg">{usados}d</p></div>
                      {agendados > 0 && <div><p className="text-xs text-gray-400">Agendados</p><p className="font-semibold text-amber-500 text-lg">{agendados}d</p></div>}
                      <div><p className="text-xs text-gray-400">Saldo</p><p className={`font-bold text-lg ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>{saldo}d</p></div>
                    </div>
                  </div>
                  {totalDireito > 0 ? (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{pct}% comprometido</span>
                        <span>Próx. renovação: {fmtDate(proxRen.toISOString().split('T')[0])} (+{DIAS_POR_ANO}d)</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
                        <div className={`h-full transition-all ${pct >= 100 ? 'bg-red-400' : pct >= 75 ? 'bg-orange-400' : 'bg-green-400'}`} style={{ width: `${Math.round((usados / totalDireito) * 100)}%` }} />
                        {agendados > 0 && <div className="h-full bg-amber-300 transition-all" style={{ width: `${Math.round((agendados / totalDireito) * 100)}%` }} />}
                      </div>
                      {agendados > 0 && <p className="text-xs text-amber-600 mt-1">■ laranja claro = agendados (ainda não tirados)</p>}
                    </div>
                  ) : (
                    <div className="mb-3 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">Primeira renovação em {fmtDate(proxRen.toISOString().split('T')[0])}</div>
                  )}
                  {renovacoes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {renovacoes.map(r => (
                        <span key={r.credito} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">{r.labelInicio} → {r.labelFim} +{DIAS_POR_ANO}d</span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── ACUMULADO ─────────────────────────────────────────────────────── */}
        {tab === 'acumulado' && (
          <div className="space-y-6">
            {funcAtivos.map(f => {
              const { renovacoes } = calcDiasAcumulados(f.data_admissao)
              const usosFuncionario = usos.filter(u => u.funcionario_id === f.id)
              const cor = cores[f.id]
              type Evento = { data: string; tipo: 'anterior'|'credito'|'uso'|'agendado'; valor: number; label: string; saldo: number }
              const base: Omit<Evento,'saldo'>[] = [
                ...(f.saldo_anterior ? [{ data: '2024-12-31', tipo: 'anterior' as const, valor: f.saldo_anterior, label: 'Saldo anterior (até dez/2024)' }] : []),
                ...renovacoes.map(r => ({ data: r.credito, tipo: 'credito' as const, valor: DIAS_POR_ANO, label: `Ciclo ${r.labelInicio} → ${r.labelFim}` })),
                ...usosFuncionario.map(u => ({ data: u.data_inicio, tipo: (u.agendado ? 'agendado' : 'uso') as 'uso'|'agendado', valor: u.dias_uteis, label: u.agendado ? `AGENDADO ${fmtDate(u.data_inicio)}→${fmtDate(u.data_fim)}${u.observacao ? ` · ${u.observacao}` : ''}` : `${fmtDate(u.data_inicio)} → ${fmtDate(u.data_fim)}${u.observacao ? ` · ${u.observacao}` : ''}` })),
              ].sort((a, b) => a.data.localeCompare(b.data))
              let sc = 0
              const extrato: Evento[] = base.map(e => { sc += (e.tipo === 'uso' || e.tipo === 'agendado') ? -e.valor : e.valor; return { ...e, saldo: sc } })
              const saldoFinal = extrato.length > 0 ? extrato[extrato.length - 1].saldo : 0
              const totalCredito = renovacoes.length * DIAS_POR_ANO + f.saldo_anterior
              const totalUso = usosFuncionario.filter(u => !u.agendado).reduce((s, u) => s + u.dias_uteis, 0)
              const totalAgend = usosFuncionario.filter(u => u.agendado).reduce((s, u) => s + u.dias_uteis, 0)
              const emFerias = emFeriasHoje(usos, f.id)

              return (
                <div key={f.id} className="card overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${cor} flex items-center justify-center text-white text-sm font-semibold`}>{f.nome.charAt(0)}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{f.nome}</p>
                          {emFerias && <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">EM FÉRIAS</span>}
                        </div>
                        <p className="text-xs text-gray-400">desde {fmtDate(f.data_admissao)}</p>
                      </div>
                    </div>
                    <div className="flex gap-4 text-right">
                      <div><p className="text-xs text-gray-400">Créditos</p><p className="font-semibold text-blue-600">+{totalCredito}d</p></div>
                      <div><p className="text-xs text-gray-400">Usados</p><p className="font-semibold text-orange-500">-{totalUso}d</p></div>
                      {totalAgend > 0 && <div><p className="text-xs text-gray-400">Agendados</p><p className="font-semibold text-amber-500">-{totalAgend}d</p></div>}
                      <div><p className="text-xs text-gray-400">Saldo</p><p className={`font-bold text-lg ${saldoFinal >= 0 ? 'text-green-600' : 'text-red-600'}`}>{saldoFinal}d</p></div>
                    </div>
                  </div>
                  {extrato.length === 0 ? <div className="px-5 py-6 text-sm text-gray-400 text-center">Nenhum movimento.</div> : (
                    <div className="divide-y divide-gray-50">
                      {extrato.map((e, i) => (
                        <div key={i} className={`px-5 py-3 flex items-center justify-between hover:bg-gray-50 ${e.tipo === 'agendado' ? 'bg-amber-50/40' : ''}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${e.tipo === 'uso' ? 'bg-orange-50 text-orange-500' : e.tipo === 'agendado' ? 'bg-amber-50 text-amber-600' : e.tipo === 'anterior' ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-600'}`}>
                              {e.tipo === 'uso' || e.tipo === 'agendado' ? '-' : '+'}
                            </div>
                            <div>
                              <p className="text-sm text-gray-800">{e.label}</p>
                              <p className="text-xs text-gray-400">{e.tipo === 'anterior' ? 'Lançamento manual' : fmtDate(e.data)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-right">
                            <span className={`text-sm font-semibold w-16 ${e.tipo === 'uso' ? 'text-orange-500' : e.tipo === 'agendado' ? 'text-amber-600' : e.tipo === 'anterior' ? 'text-gray-600' : 'text-blue-600'}`}>
                              {e.tipo === 'uso' || e.tipo === 'agendado' ? '-' : '+'}{e.valor}d
                              {e.tipo === 'agendado' && <span className="block text-xs font-normal text-amber-400">agendado</span>}
                            </span>
                            <span className={`text-sm font-bold w-12 ${e.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>{e.saldo}d</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {extrato.length > 0 && (
                    <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between">
                      <span className="text-xs text-gray-400">Saldo até hoje · {new Date().toLocaleDateString('pt-BR')}</span>
                      <span className={`font-bold ${saldoFinal >= 0 ? 'text-green-600' : 'text-red-600'}`}>{saldoFinal}d</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── AGENDADO ──────────────────────────────────────────────────────── */}
        {tab === 'agendado' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 mb-2">Agende férias futuras com datas. Os dias serão descontados do saldo mas aparecem separados como "a tirar".</p>
            {erroAgend && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-4 py-3">{erroAgend}</div>}
            {okAgend && <div className="bg-green-50 border border-green-100 text-green-800 text-sm rounded-lg px-4 py-3">{okAgend}</div>}

            {funcAtivos.map(f => {
              const { totalDireito, totalGasto, saldo } = saldoFunc(f)
              const agendsFuncionario = usos.filter(u => u.funcionario_id === f.id && u.agendado)
                .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
              const cor = cores[f.id]
              const emFerias = emFeriasHoje(usos, f.id)
              const aberto = abrirAgend === f.id

              return (
                <div key={f.id} className="card overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50" onClick={() => setAbrirAgend(aberto ? null : f.id)}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${cor} flex items-center justify-center text-white text-sm font-semibold`}>{f.nome.charAt(0)}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{f.nome}</p>
                          {emFerias && <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">EM PERÍODO DE FÉRIAS</span>}
                        </div>
                        <p className="text-xs text-gray-400">{f.cargo || 'Sem cargo'} · saldo: <span className={saldo >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{saldo}d</span></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {agendsFuncionario.length > 0 && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{agendsFuncionario.length} agendamento{agendsFuncionario.length > 1 ? 's' : ''}</span>}
                      <span className="text-gray-300 text-lg">{aberto ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Lista de agendamentos existentes */}
                  {agendsFuncionario.length > 0 && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {agendsFuncionario.map(u => {
                        const passado = u.data_fim < hoje
                        const emCurso = u.data_inicio <= hoje && u.data_fim >= hoje
                        return (
                          <div key={u.id} className={`px-5 py-3 flex items-center justify-between group ${emCurso ? 'bg-amber-50' : passado ? 'bg-gray-50' : ''}`}>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-800">{fmtDate(u.data_inicio)} → {fmtDate(u.data_fim)}</span>
                                {emCurso && <span className="bg-amber-200 text-amber-800 text-xs font-bold px-1.5 py-0.5 rounded">EM CURSO</span>}
                                {passado && <span className="bg-gray-200 text-gray-500 text-xs px-1.5 py-0.5 rounded">Concluído</span>}
                                {!emCurso && !passado && <span className="bg-blue-50 text-blue-600 text-xs px-1.5 py-0.5 rounded">Futuro</span>}
                              </div>
                              {u.observacao && <p className="text-xs text-gray-400 mt-0.5">{u.observacao}</p>}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-amber-600">{u.dias_uteis}d úteis</span>
                              <button onClick={() => deletarUso(u.id)} className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500 text-xs transition-opacity">✕</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Form de novo agendamento */}
                  {aberto && (
                    <form onSubmit={e => { setNovoAgend(p => ({ ...p, funcionario_id: f.id })); registrarAgend(e) }}
                      className="px-5 pb-5 pt-3 border-t border-dashed border-amber-200 bg-amber-50/40">
                      <p className="text-xs text-amber-700 font-medium mb-3">Novo agendamento para {f.nome}</p>
                      <div className="flex gap-3 items-end flex-wrap">
                        <div>
                          <label className="label">Data início *</label>
                          <input className="input" type="date" value={novoAgend.data_inicio}
                            onChange={e => setNovoAgend(p => ({ ...p, data_inicio: e.target.value, funcionario_id: f.id }))} required />
                        </div>
                        <div>
                          <label className="label">Data fim *</label>
                          <input className="input" type="date" value={novoAgend.data_fim}
                            onChange={e => setNovoAgend(p => ({ ...p, data_fim: e.target.value, funcionario_id: f.id }))} required />
                        </div>
                        {diasAgendCalc > 0 && novoAgend.funcionario_id === f.id && (
                          <div className="bg-amber-100 text-amber-800 text-sm font-semibold px-3 py-2 rounded-lg">{diasAgendCalc}d úteis</div>
                        )}
                        <div className="flex-1 min-w-[160px]">
                          <label className="label">Observação</label>
                          <input className="input" type="text" placeholder="Opcional" value={novoAgend.observacao}
                            onChange={e => setNovoAgend(p => ({ ...p, observacao: e.target.value }))} />
                        </div>
                        <button className="btn-primary whitespace-nowrap" type="submit" disabled={loadingAgend || !diasAgendCalc}>
                          {loadingAgend ? 'Salvando...' : 'Agendar'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── HISTÓRICO ─────────────────────────────────────────────────────── */}
        {tab === 'historico' && (
          <div className="space-y-6">
            {funcAtivos.map(f => {
              const usosFuncionario = usos.filter(u => u.funcionario_id === f.id && !u.agendado).sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))
              const porAno: Record<string, Uso[]> = {}
              usosFuncionario.forEach(u => { const a = getAno(u.data_inicio); if (!porAno[a]) porAno[a] = []; porAno[a].push(u) })
              const anos = Object.keys(porAno).sort((a, b) => b.localeCompare(a))
              const cor = cores[f.id]
              const { totalDireito, totalGasto } = saldoFunc(f)

              return (
                <div key={f.id} className="card overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${cor} flex items-center justify-center text-white text-sm font-semibold`}>{f.nome.charAt(0)}</div>
                      <div><p className="font-semibold text-gray-900">{f.nome}</p><p className="text-xs text-gray-500">{f.cargo || 'Sem cargo'}</p></div>
                    </div>
                    <div className="flex gap-4 text-right text-sm">
                      <div><p className="text-xs text-gray-400">Acumulado</p><p className="font-semibold text-gray-700">{totalDireito}d</p></div>
                      <div><p className="text-xs text-gray-400">Usados</p><p className="font-semibold text-orange-500">{totalGasto}d</p></div>
                      <div><p className="text-xs text-gray-400">Saldo</p><p className={`font-bold ${totalDireito - totalGasto >= 0 ? 'text-green-600' : 'text-red-600'}`}>{totalDireito - totalGasto}d</p></div>
                    </div>
                  </div>
                  {usosFuncionario.length === 0 ? <div className="px-5 py-6 text-sm text-gray-400 text-center">Nenhum registro.</div> : (
                    <div className="divide-y divide-gray-50">
                      {anos.map(ano => {
                        const usosAno = porAno[ano]
                        const totalAno = usosAno.reduce((s, u) => s + u.dias_uteis, 0)
                        return (
                          <div key={ano} className="px-5 py-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-semibold text-gray-700">{ano}</span>
                              <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{totalAno}d usados</span>
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
                                        <span className="text-sm text-gray-800 font-medium">{fmtDate(u.data_inicio)} → {fmtDate(u.data_fim)}</span>
                                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{fmtMesAno(u.data_inicio)}</span>
                                      </div>
                                      {u.observacao && <p className="text-xs text-gray-400 mt-0.5">{u.observacao}</p>}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-semibold text-orange-600">{u.dias_uteis}d úteis</span>
                                      <button onClick={() => deletarUso(u.id)} className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500 transition-opacity text-xs">✕</button>
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

        {/* ── REGISTRAR USO ─────────────────────────────────────────────────── */}
        {tab === 'registrar' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 mb-2">Registre dias já utilizados (sem data específica).</p>
            {erroUso && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-4 py-3">{erroUso}</div>}
            {okUso && <div className="bg-green-50 border border-green-100 text-green-800 text-sm rounded-lg px-4 py-3">{okUso}</div>}
            {funcAtivos.map(f => {
              const { saldo } = saldoFunc(f)
              const cor = cores[f.id]
              const aberto = novoUso.funcionario_id === f.id
              return (
                <div key={f.id} className="card overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                    onClick={() => setNovoUso(p => ({ ...p, funcionario_id: aberto ? '' : f.id, dias: '', observacao: '' }))}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${cor} flex items-center justify-center text-white text-sm font-semibold`}>{f.nome.charAt(0)}</div>
                      <div><p className="font-medium text-gray-900">{f.nome}</p><p className="text-xs text-gray-400">{f.cargo || 'Sem cargo'}</p></div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-sm font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>{saldo}d de saldo</span>
                      <span className="text-gray-300 text-lg">{aberto ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {aberto && (
                    <form onSubmit={registrarUso} className="px-5 pb-5 pt-1 border-t border-gray-100 flex gap-3 items-end">
                      <div className="flex-1">
                        <label className="label">Dias usados *</label>
                        <input className="input" type="number" min="1" placeholder="Ex: 10" value={novoUso.dias}
                          onChange={e => setNovoUso(p => ({ ...p, dias: e.target.value }))} autoFocus required />
                      </div>
                      <div className="flex-[2]">
                        <label className="label">Observação</label>
                        <input className="input" type="text" placeholder="Opcional" value={novoUso.observacao}
                          onChange={e => setNovoUso(p => ({ ...p, observacao: e.target.value }))} />
                      </div>
                      <button className="btn-primary whitespace-nowrap" type="submit" disabled={loadingUso || !novoUso.dias}>
                        {loadingUso ? 'Salvando...' : 'Lançar dias'}
                      </button>
                    </form>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── FUNCIONÁRIOS ──────────────────────────────────────────────────── */}
        {tab === 'funcionarios' && (
          <div>
            <div className="card p-6 mb-6">
              <p className="text-sm font-medium text-gray-700 mb-1">Novo funcionário</p>
              {erroFunc && <div className="mb-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-4 py-3">{erroFunc}</div>}
              {okFunc && <div className="mb-4 bg-green-50 border border-green-100 text-green-800 text-sm rounded-lg px-4 py-3">{okFunc}</div>}
              <form onSubmit={criarFuncionario} className="grid grid-cols-3 gap-4">
                <div><label className="label">Nome *</label><input className="input" type="text" value={novoFunc.nome} onChange={e => setNovoFunc(p => ({ ...p, nome: e.target.value }))} required placeholder="Nome completo" /></div>
                <div><label className="label">Data de admissão *</label><input className="input" type="date" value={novoFunc.data_admissao} onChange={e => setNovoFunc(p => ({ ...p, data_admissao: e.target.value }))} required /></div>
                <div><label className="label">Cargo</label><input className="input" type="text" value={novoFunc.cargo} onChange={e => setNovoFunc(p => ({ ...p, cargo: e.target.value }))} placeholder="Ex: Secretária" /></div>
                <div className="col-span-3 flex justify-end"><button className="btn-primary" type="submit" disabled={loadingFunc}>{loadingFunc ? 'Cadastrando...' : 'Cadastrar'}</button></div>
              </form>
            </div>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Nome','Cargo','Admissão','Renova em','Saldo anterior','Saldo total','Status',''].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {funcionarios.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-400">Nenhum funcionário.</td></tr>}
                  {funcionarios.map(f => {
                    const { totalDireito, totalGasto, saldo } = saldoFunc(f)
                    const admissao = new Date(f.data_admissao + 'T12:00:00')
                    const proxRen = new Date(admissao); const hojeD = new Date()
                    proxRen.setFullYear(proxRen.getFullYear() + 1)
                    while (proxRen <= hojeD) proxRen.setFullYear(proxRen.getFullYear() + 1)
                    return (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full ${cores[f.id]||'bg-gray-300'} flex items-center justify-center text-white text-xs font-semibold`}>{f.nome.charAt(0)}</div>
                            <span className="font-medium text-gray-900">{f.nome}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{f.cargo || '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(f.data_admissao)}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(proxRen.toISOString().split('T')[0])}</td>
                        <td className="px-4 py-3">
                          {editSaldo === f.id ? (
                            <div className="flex items-center gap-1">
                              <input type="number" className="w-16 border border-gray-200 rounded px-2 py-0.5 text-sm" value={saldoInputs[f.id] ?? String(f.saldo_anterior)}
                                onChange={e => setSaldoInputs(p => ({ ...p, [f.id]: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') salvarSaldoAnterior(f); if (e.key === 'Escape') setEditSaldo(null) }} autoFocus />
                              <button onClick={() => salvarSaldoAnterior(f)} className="text-green-600 text-xs font-medium">✓</button>
                              <button onClick={() => setEditSaldo(null)} className="text-gray-400 text-xs">✕</button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditSaldo(f.id); setSaldoInputs(p => ({ ...p, [f.id]: String(f.saldo_anterior) })) }}
                              className="flex items-center gap-1 group text-sm text-gray-600 hover:text-utah-600">
                              <span className="font-medium">{f.saldo_anterior}d</span>
                              <span className="text-gray-300 group-hover:text-utah-400 text-xs">✏</span>
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3"><span className={`font-semibold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>{saldo}d</span></td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${f.ativo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{f.ativo ? 'Ativo' : 'Inativo'}</span>
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
