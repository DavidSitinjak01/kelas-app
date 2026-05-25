import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Form Isi Nilai - Kelas App',
  description: 'Form untuk siswa mengisi nilai mata pelajaran. Login menggunakan NISN dan NIK.',
}

export default function FormNilaiLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
