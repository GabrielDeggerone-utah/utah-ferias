'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Props = {
  children: React.ReactNode
  email: string
}

export default function Layout({ children, email }: Props) {
  const path = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col fixed h-full">
        <div className="px-5 py-5 border-b border-gray-100">
          <p className="font-semibold text-utah-600 text-base">Utah Invest</p>
          <p className="text-xs text-gray-400 mt-0.5">Controle de Férias</p>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5">
          <Link
            href="/ferias"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              path === '/ferias' ? 'bg-utah-50 text-utah-600 font-medium' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <CalendarIcon className="w-4 h-4 shrink-0" />
            Férias
          </Link>
        </nav>

        <div className="px-3 py-4 border-t border-gray-100">
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-utah-100 flex items-center justify-center text-utah-600 text-xs font-semibold">
              {email.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 truncate">{email}</p>
            </div>
          </div>
          <button
            onClick={sair}
            className="flex items-center gap-2 px-3 py-2 w-full text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogoutIcon className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      <main className="ml-56 flex-1 min-h-screen">
        {children}
      </main>
    </div>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
}
function LogoutIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
}
