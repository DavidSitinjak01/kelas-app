import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

// ============================================================
// ANALISA JURUSAN LANJUT - Detail per siswa (LLM-powered)
// Menggunakan AI untuk analisa mendalam per siswa
// ============================================================

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { siswaId } = body

    if (!siswaId) {
      return NextResponse.json({ error: 'siswaId diperlukan' }, { status: 400 })
    }

    // Fetch student data
    const siswa = await db.siswa.findUnique({
      where: { id: siswaId },
      include: {
        rombel: true,
        nilai: true,
        tka: true,
      },
    })

    if (!siswa) {
      return NextResponse.json({ error: 'Siswa tidak ditemukan' }, { status: 404 })
    }

    // Prepare data summary - simplified to reduce token count
    const nilaiSummary = siswa.nilai
      .filter(n => n.rerata > 0)
      .sort((a, b) => b.rerata - a.rerata)
      .map(n => `${n.mataPelajaran}: ${n.rerata.toFixed(1)}`)
      .join('\n')

    const overallAvg = siswa.nilai.filter(n => n.rerata > 0).length > 0
      ? siswa.nilai.filter(n => n.rerata > 0).reduce((s, n) => s + n.rerata, 0) / siswa.nilai.filter(n => n.rerata > 0).length
      : 0

    let tkaSummary = ''
    if (siswa.tka) {
      const t = siswa.tka
      tkaSummary = `
Data TKA (Tes Kompetensi Akademik):
- Bahasa Indonesia: ${t.bindoNilai} (${t.bindoKategori})
- Matematika: ${t.matNilai} (${t.matKategori})
- Bahasa Inggris: ${t.bingNilai} (${t.bingKategori})
- Pilihan 1: ${t.pilihan1Nama} = ${t.pilihan1Nilai} (${t.pilihan1Kategori})
- Pilihan 2: ${t.pilihan2Nama} = ${t.pilihan2Nilai} (${t.pilihan2Kategori})
- Nomor Peserta: ${t.nomorPeserta}
- Tanggal Pelaksanaan: ${t.tanggalPelaksanaan}`
    }

    const zai = await ZAI.create()

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `Kamu adalah konselor pendidikan dan ahli analisis jurusan perguruan tinggi di Indonesia. Kamu menganalisis profil akademik siswa SMA untuk memberikan rekomendasi jurusan perguruan tinggi yang paling cocok dan realistis.

Analisis harus mempertimbangkan:
1. Kecenderungan akademik (IPA/IPS) berdasarkan nilai rapor
2. Mata pelajaran unggulan dan yang perlu ditingkatkan
3. Tren perkembangan nilai (meningkat/menurun)
4. Nilai TKA (jika ada) sebagai indikator kompetensi dan minat
5. Mata pelajaran pilihan TKA sebagai indikator arah minat
6. Peluang masuk perguruan tinggi melalui jalur SNBP, SNBT, dan mandiri

Jawab dalam Bahasa Indonesia dengan format yang terstruktur dan mudah dipahami.`
        },
        {
          role: 'user',
          content: `Analisis jurusan perguruan tinggi yang paling cocok untuk siswa berikut:

Nama: ${siswa.nama}
NIS: ${siswa.nis}
NISN: ${siswa.nisn}
Kelas: ${siswa.rombel.kelas}
Rombel: ${siswa.rombel.nama}
Jurusan Rombel: ${siswa.rombel.jurusan}
Rata-rata Keseluruhan: ${overallAvg.toFixed(1)}

Detail Nilai Rapor:
${nilaiSummary || 'Belum ada data nilai'}
${tkaSummary}

Berikan analisis dalam format berikut:

## Analisis Kecenderungan Akademik
- Analisis kecenderungan IPA/IPS berdasarkan nilai, termasuk skor dan tren

## Rekomendasi Jurusan (Top 3)
Untuk setiap jurusan, berikan:
- Nama Jurusan (contoh: Teknik Sipil, Kedokteran, Akuntansi, dll)
- Skor Kesesuaian (1-100)
- Alasan kenapa cocok
- Mata pelajaran unggulan dan perlu ditingkatkan

## Analisis TKA (hanya jika ada data TKA)
- Interpretasi skor TKA, khususnya pilihan, apa indikasinya

## Strategi Masuk PTN
- Rekomendasi PTN dan fakultas dengan peluang realistis
- Jalur masuk terbaik (SNBP/SNBT/Mandiri)

## Tips Persiapan
- Mata pelajaran yang perlu difokuskan
- Langkah konkret yang harus dilakukan

## Kesimpulan
- Rangkuman jurusan yang paling cocok dan alasannya
- Saran motivasi untuk siswa`
        }
      ],
      thinking: { type: 'disabled' }
    })

    const analysis = completion.choices[0]?.message?.content || 'Tidak dapat menghasilkan analisis'

    return NextResponse.json({
      siswaId,
      nama: siswa.nama,
      nis: siswa.nis,
      rombelNama: siswa.rombel.nama,
      kelas: siswa.rombel.kelas,
      analysis,
    })
  } catch (error) {
    console.error('Analisa jurusan lanjut detail error:', error)
    return NextResponse.json({ error: 'Gagal menghasilkan analisis' }, { status: 500 })
  }
}
