import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()

  if (body.tipo === 'periodo') {
    const { funcionario_id, ano, dias_direito, observacao } = body
    if (!funcionario_id || !ano) return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })

    const { data, error } = await supabase
      .from('periodos_ferias')
      .upsert({ funcionario_id, ano, dias_direito: dias_direito ?? 30, observacao: observacao || null }, { onConflict: 'funcionario_id,ano' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  }

  if (body.tipo === 'uso') {
    const { funcionario_id, data_inicio, data_fim, dias_uteis, observacao, agendado } = body
    if (!funcionario_id || !data_inicio || !data_fim || dias_uteis === undefined) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('usos_ferias')
      .insert({ funcionario_id, data_inicio, data_fim, dias_uteis, observacao: observacao || null, agendado: agendado ?? false })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()

  if (body.tipo === 'periodo') {
    const { id, dias_direito, observacao } = body
    const { error } = await supabase.from('periodos_ferias').update({ dias_direito, observacao }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (body.tipo === 'uso') {
    const { id, data_inicio, data_fim, dias_uteis, observacao } = body
    const { error } = await supabase.from('usos_ferias').update({ data_inicio, data_fim, dias_uteis, observacao }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id, tipo } = await req.json()
  const table = tipo === 'periodo' ? 'periodos_ferias' : 'usos_ferias'
  await supabase.from(table).delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
