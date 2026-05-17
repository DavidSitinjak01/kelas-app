import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nama, kelas, jurusan, jurusanMinat, nilai } = body

    if (!nama || !nilai || nilai.length === 0) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
    }

    const zai = await ZAI.create()

    const nilaiSummary = nilai.map((n: { mapel: string; rerata: number }) =>
      `${n.mapel}: ${n.rerata}`
    ).join('\n')

    const rataRata = nilai.reduce((a: number, n: { rerata: number }) => a + n.rerata, 0) / nilai.length

    const jurusanMinatText = jurusanMinat
      ? `Jurusan yang diminati: ${jurusanMinat}`
      : 'Belum ada jurusan yang spesifik diminati'

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `Kamu adalah konselor pendidikan dan ahli seleksi masuk perguruan tinggi di Indonesia. Kamu memberikan rekomendasi perguruan tinggi berdasarkan profil akademik siswa SMA, jurusan yang diminati, dan kemampuan akademik. Berikan rekomendasi yang realistis dan sesuai dengan kondisi pendidikan di Indonesia, termasuk jalur masuk SNBP, SNBT, dan mandiri. Jawab dalam Bahasa Indonesia.`
        },
        {
          role: 'user',
          content: `Berikan rekomendasi perguruan tinggi untuk siswa berikut:

Nama: ${nama}
Kelas: ${kelas}
Jurusan SMA: ${jurusan}
Rata-rata nilai: ${rataRata.toFixed(1)}
${jurusanMinatText}

Detail Nilai (Rerata per mapel):
${nilaiSummary}

Berikan rekomendasi dalam format berikut:
1. **Profil Akademik** - Ringkasan kemampuan akademik siswa
2. **Rekomendasi Perguruan Tinggi** - 5-7 perguruan tinggi yang cocok (campuran PTN dan PTS jika memungkinkan) dengan:
   - Nama PT
   - Jurusan/fakultas yang direkomendasikan
   - Alasan kenapa cocok
   - Estimasi peluang masuk (tinggi/sedang/rendah)
3. **Jalur Masuk** - Rekomendasi jalur masuk (SNBP/SNBT/Mandiri) yang paling strategis
4. **Tips Persiapan** - Hal yang perlu dipersiapkan untuk seleksi masuk`
        }
      ],
      thinking: { type: 'disabled' }
    })

    const rekomendasi = completion.choices[0]?.message?.content || 'Tidak dapat menghasilkan rekomendasi'

    return NextResponse.json({ rekomendasi })
  } catch (error) {
    console.error('Rekomendasi PT error:', error)
    return NextResponse.json({ error: 'Gagal menghasilkan rekomendasi' }, { status: 500 })
  }
}
