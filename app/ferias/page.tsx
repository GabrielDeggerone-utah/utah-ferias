import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import FeriasClient from './FeriasClient'

export default async function FeriasPage() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: funcionarios } = await supabase
    .from('funcionarios')
    .select('*')
    .order('nome')

  const { data: periodos } = await supabase
    .from('periodos_ferias')
    .select('*')
    .order('ano')

  const { data: usos } = await supabase
    .from('usos_ferias')
    .select('*')
    .order('data_inicio', { ascending: false })

  return (
    <FeriasClient
      email={user.email ?? ''}
      funcionarios={funcionarios ?? []}
      periodos={periodos ?? []}
      usos={usos ?? []}
    />
  )
}
