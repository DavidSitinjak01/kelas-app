import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nama, kelas, jurusan, nilai } = body

    if (!nama || !nilai || nilai.length === 0) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
    }

    const zai = await ZAI.create()

    const nilaiSummary = nilai.map((n: { mapel: string; nilaiAsli: number; nilaiUp: number }) =>
      `${n.mapel}: ${n.nilaiAsli} (asli), ${n.nilaiUp} (up)`
    ).join('\n')

    const rataRata = nilai.reduce((a: number, n: { nilaiAsli: number }) => a + n.nilaiAsli, 0) / nilai.length
    const mapelUnggulan = [...nilai]
      .sort((a: { nilaiAsli: number }, b: { nilaiAsli: number }) => b.nilaiAsli - a.nilaiAsli)
      .slice(0, 5)
      .map((n: { mapel: string; nilaiAsli: number }) => `${n.mapel} (${n.nilaiAsli})`)
      .join(', ')

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `Kamu adalah konselor pendidikan dan ahli bimbingan jurusan di Indonesia. Kamu memberikan rekomendasi jurusan kuliah berdasarkan profil akademik siswa SMA. Berikan rekomendasi yang realistis dan sesuai dengan kondisi pendidikan di Indonesia. Jawab dalam Bahasa Indonesia.`
        },
        {
          role: 'user',
          content: `Berikan rekomendasi jurusan kuliah untuk siswa berikut:

Nama: ${nama}
Kelas: ${kelas}
Jurusan SMA: ${jurusan}
Rata-rata nilai: ${rataRata.toFixed(1)}
Mata pelajaran unggulan: ${mapelUnggulan}

Detail Nilai:
${nilaiSummary}

Berikan rekomendasi dalam format berikut:
1. **Analisis Profil** - Analisis kekuatan dan kelemahan akademik
2. **Rekomendasi Jurusan** - 5 jurusan kuliah yang cocok dengan penjelasan mengapa cocok
3. **Prospek Karir** - Prospek karir dari jurusan yang direkomendasikan
4. **Saran Persiapan** - Hal yang perlu dipersiapkan untuk masuk jurusan tersebut`
        }
      ],
      thinking: { type: 'disabled' }
    })

    const rekomendasi = completion.choices[0]?.message?.content || 'Tidak dapat menghasilkan rekomendasi'

    return NextResponse.json({ rekomendasi })
  } catch (error) {
    console.error('Rekomendasi jurusan error:', error)
    return NextResponse.json({ error: 'Gagal menghasilkan rekomendasi' }, { status: 500 })
  }
}
