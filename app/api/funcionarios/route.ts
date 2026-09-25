import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'

async function verificarAuth() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST(req: NextRequest) {
  const user = await verificarAuth()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { nome, data_admissao, cargo } = await req.json()
  if (!nome || !data_admissao) return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('funcionarios')
    .insert({ nome, data_admissao, cargo: cargo || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const user = await verificarAuth()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id, nome, data_admissao, cargo, ativo } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (nome !== undefined) updates.nome = nome
  if (data_admissao !== undefined) updates.data_admissao = data_admissao
  if (cargo !== undefined) updates.cargo = cargo
  if (ativo !== undefined) updates.ativo = ativo

  const admin = createAdminSupabase()
  const { error } = await admin.from('funcionarios').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
