import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

// ============================================================
// ANALISA JURUSAN LANJUT - Detail per siswa (LLM-powered)
// Menggunakan AI untuk analisa mendalam per siswa
// ============================================================

// Allow up to 120 seconds for LLM response
export const maxDuration = 120

// Retry helper with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 2000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`Attempt ${attempt}/${maxRetries} failed:`, lastError.message)
      
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1)
        console.log(`Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError || new Error('All retries failed')
}

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

    // Prepare data summary - include semester data for trend analysis
    const nilaiSummary = siswa.nilai
      .filter(n => n.rerata > 0)
      .sort((a, b) => b.rerata - a.rerata)
      .map(n => {
        const sems = [n.smt1, n.smt2, n.smt3, n.smt4, n.smt5, n.smt6].filter(v => v > 0)
        const trend = sems.length >= 2
          ? (() => {
              const firstHalf = [n.smt1, n.smt2, n.smt3].filter(v => v > 0)
              const secondHalf = [n.smt4, n.smt5, n.smt6].filter(v => v > 0)
              if (firstHalf.length === 0 || secondHalf.length === 0) return 'stabil'
              const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
              const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
              const diff = avgSecond - avgFirst
              if (diff > 3) return `meningkat (+${diff.toFixed(1)})`
              if (diff < -3) return `menurun (${diff.toFixed(1)})`
              return 'stabil'
            })()
          : 'data kurang'

        return `${n.mataPelajaran}: ${n.rerata.toFixed(1)} [tren: ${trend}]`
      })
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

    // Use retry logic for LLM call
    const result = await retryWithBackoff(async () => {
      const zai = await ZAI.create()

      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'assistant',
            content: `Kamu adalah konselor pendidikan dan ahli analisis jurusan perguruan tinggi di Indonesia. Kamu menganalisis profil akademik siswa SMA untuk memberikan rekomendasi jurusan perguruan tinggi yang paling cocok dan realistis.

Analisis harus mempertimbangkan:
1. Kecenderungan akademik (IPA/IPS) berdasarkan nilai rapor
2. Mata pelajaran unggulan dan yang perlu ditingkatkan
3. Tren perkembangan nilai per mata pelajaran (meningkat/menurun/stabil)
4. Pengaruh tren perkembangan nilai terhadap rekomendasi jurusan
5. Nilai TKA (jika ada) sebagai indikator kompetensi dan minat
6. Mata pelajaran pilihan TKA sebagai indikator arah minat
7. Peluang masuk perguruan tinggi melalui jalur SNBP, SNBT, dan mandiri

PENTING: Berikan rekomendasi jurusan yang SPESIFIK, bukan hanya kategori umum.
Contoh pemetaan mapel ke jurusan spesifik:
- Bahasa Indonesia unggul → Sastra Indonesia, Pendidikan Bahasa Indonesia, Ilmu Komunikasi, Jurnalistik
- Matematika + Fisika unggul → Teknik Sipil, Teknik Mesin, Teknik Elektro, Arsitektur
- Biologi + Kimia unggul → Kedokteran, Farmasi, Kedokteran Gigi, Keperawatan, Gizi
- Matematika + Informatika unggul → Teknik Informatika, Sistem Informasi, Data Science, Ilmu Komputer
- Ekonomi + Matematika unggul → Akuntansi, Manajemen, Ekonomi Pembangunan, Perbankan & Keuangan Digital
- Bahasa Inggris + Geografi unggul → Hubungan Internasional, Pariwisata & Perhotelan, Sastra Inggris
- Sosiologi + Sejarah unggul → Hukum, Administrasi Publik, Psikologi, Pendidikan
- Bahasa Indonesia + Sejarah + Antropologi → Sastra Indonesia & Daerah, Ilmu Komunikasi, Pendidikan Bahasa Indonesia

Jika tren nilai suatu mapel MENINGKAT, maka jurusan terkait mapel tersebut lebih ditekankan.
Jika tren nilai MENURUN, berikan catatan bahwa perlu perhatian khusus.

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

Detail Nilai Rapor (dengan tren perkembangan):
${nilaiSummary || 'Belum ada data nilai'}
${tkaSummary}

Berikan analisis dalam format berikut:

## Analisis Kecenderungan Akademik
- Analisis kecenderungan IPA/IPS berdasarkan nilai, termasuk skor dan tren

## Analisis Tren Perkembangan Nilai
- Mapel yang nilainya meningkat dan implikasinya
- Mapel yang nilainya menurun dan langkah perbaikan
- Mapel yang stabil dan konsistensinya

## Rekomendasi Jurusan Spesifik (Top 5)
Untuk setiap jurusan, berikan:
- Nama Jurusan Spesifik (contoh: Teknik Informatika, Kedokteran, Akuntansi, Sastra Indonesia, dll - BUKAN kategori umum)
- Skor Kesesuaian (1-100)
- Alasan kenapa cocok (hubungkan dengan mapel unggulan dan tren)
- Mata pelajaran unggulan pendukung
- Mata pelajaran perlu ditingkatkan
- Prospek karir singkat

## Analisis TKA (hanya jika ada data TKA)
- Interpretasi skor TKA, khususnya pilihan, apa indikasinya
- Kesesuaian pilihan TKA dengan jurusan yang direkomendasikan

## Strategi Masuk PTN
- Rekomendasi PTN dan fakultas dengan peluang realistis
- Jalur masuk terbaik (SNBP/SNBT/Mandiri)
- Tips untuk meningkatkan peluang

## Tips Persiapan
- Mata pelajaran yang perlu difokuskan
- Langkah konkret yang harus dilakukan
- Rekomendasi bimbingan tambahan

## Kesimpulan
- Rangkuman 3 jurusan yang paling cocok dan alasannya
- Saran motivasi untuk siswa`
          }
        ],
        thinking: { type: 'disabled' }
      })

      const analysis = completion.choices[0]?.message?.content || 'Tidak dapat menghasilkan analisis'
      return analysis
    }, 3, 2000)

    return NextResponse.json({
      siswaId,
      nama: siswa.nama,
      nis: siswa.nis,
      rombelNama: siswa.rombel.nama,
      kelas: siswa.rombel.kelas,
      analysis: result,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('Analisa jurusan lanjut detail error:', error)
    
    // Return more specific error message
    let userMessage = 'Gagal menghasilkan analisis AI'
    if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
      userMessage = 'Analisis AI timeout — server membutuhkan waktu terlalu lama. Silakan coba lagi.'
    } else if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
      userMessage = 'Server AI sedang sibuk — silakan tunggu beberapa saat dan coba lagi.'
    } else if (errorMsg.includes('network') || errorMsg.includes('ECONNREFUSED')) {
      userMessage = 'Koneksi ke server AI gagal — periksa koneksi internet dan coba lagi.'
    } else if (errorMsg.includes('All retries failed')) {
      userMessage = 'Analisis AI gagal setelah beberapa percobaan. Silakan coba lagi dalam beberapa saat.'
    }
    
    return NextResponse.json({ error: userMessage, detail: errorMsg }, { status: 500 })
  }
}
