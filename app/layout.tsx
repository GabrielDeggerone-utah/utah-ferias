import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Utah Invest — Férias',
  description: 'Controle de férias — escritório Utah Invest',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
