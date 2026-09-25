import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { nome, data_admissao, cargo } = await req.json()
  if (!nome || !data_admissao) return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })

  const { data, error } = await supabase
    .from('funcionarios')
    .insert({ nome, data_admissao, cargo: cargo || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id, nome, data_admissao, cargo, ativo } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (nome !== undefined) updates.nome = nome
  if (data_admissao !== undefined) updates.data_admissao = data_admissao
  if (cargo !== undefined) updates.cargo = cargo
  if (ativo !== undefined) updates.ativo = ativo

  const { error } = await supabase.from('funcionarios').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
