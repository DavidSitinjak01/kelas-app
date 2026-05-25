import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

// ============================================================
// ANALISA JURUSAN LANJUT - Detail per siswa (LLM-powered)
// Menggunakan AI untuk analisa mendalam per siswa
// ============================================================

// Allow up to 300 seconds for LLM response (next dev mode)
export const maxDuration = 300

// Timeout wrapper for LLM calls
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`LLM_TIMEOUT: Request timed out after ${ms / 1000}s`)), ms)
    promise.then(
      (val) => { clearTimeout(timer); resolve(val) },
      (err) => { clearTimeout(timer); reject(err) }
    )
  })
}

// Retry helper with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  initialDelay: number = 2000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`[AI-Analysis] Attempt ${attempt}/${maxRetries} failed:`, lastError.message)

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1)
        console.log(`[AI-Analysis] Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error('All retries failed')
}

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { siswaid } = body

    if (!siswaid) {
      return NextResponse.json({ error: 'siswaid diperlukan' }, { status: 400 })
    }

    // Fetch student data
    const siswa = await db.siswa.findUnique({
      where: { id: siswaid },
      include: {
        rombel: true,
        nilai: true,
        tka: true,
      },
    })

    if (!siswa) {
      return NextResponse.json({ error: 'Siswa tidak ditemukan' }, { status: 404 })
    }

    // Check if student has grades
    const nilaiWithScore = siswa.nilai.filter(n => n.rerata > 0)
    if (nilaiWithScore.length === 0) {
      return NextResponse.json({
        error: 'Siswa belum memiliki data nilai. Import nilai rapor terlebih dahulu.'
      }, { status: 400 })
    }

    // Prepare data summary - include semester data for trend analysis
    const nilaiSummary = nilaiWithScore
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
              if (diff > 3) return `↑+${diff.toFixed(1)}`
              if (diff < -3) return `↓${diff.toFixed(1)}`
              return '→'
            })()
          : '?'

        return `${n.matapelajaran}: ${n.rerata.toFixed(1)} (${trend})`
      })
      .join('\n')

    const overallAvg = nilaiWithScore.reduce((s, n) => s + n.rerata, 0) / nilaiWithScore.length

    // Top 5 subjects
    const topSubjects = nilaiWithScore
      .sort((a, b) => b.rerata - a.rerata)
      .slice(0, 5)
      .map(n => n.matapelajaran)
      .join(', ')

    // Bottom 3 subjects
    const bottomSubjects = nilaiWithScore
      .sort((a, b) => a.rerata - b.rerata)
      .slice(0, 3)
      .map(n => `${n.matapelajaran}(${n.rerata.toFixed(1)})`)
      .join(', ')

    let tkaSummary = ''
    if (siswa.tka) {
      const t = siswa.tka
      const avgWajib = ((t.bindonilai || 0) + (t.matnilai || 0) + (t.bingnilai || 0)) / 3
      tkaSummary = `
TKA: Bin=${t.bindonilai}(${t.bindokategori}) Mat=${t.matnilai}(${t.matkategori}) Bing=${t.bingnilai}(${t.bingkategori}) Pil1=${t.pilihan1nama}=${t.pilihan1nilai}(${t.pilihan1kategori}) Pil2=${t.pilihan2nama}=${t.pilihan2nilai}(${t.pilihan2kategori}) AvgWajib=${avgWajib.toFixed(1)}`
    }

    console.log(`[AI-Analysis] Starting analysis for ${siswa.nama} (${siswaid}), elapsed: ${Date.now() - startTime}ms`)

    // Use retry logic for LLM call with 120s timeout per attempt
    const result = await retryWithBackoff(async () => {
      const zai = await ZAI.create()

      const analysisResult = await withTimeout(
        zai.chat.completions.create({
          messages: [
            {
              role: 'assistant',
              content: `Kamu konselor pendidikan Indonesia. Analisis profil akademik siswa SMA, berikan rekomendasi jurusan PT yang spesifik & realistis.

Pemetaan mapel→jurusan (WAJIB ikuti):
- Bahasa Indonesia unggul → Sastra Indonesia, Pendidikan Bahasa Indonesia, Ilmu Komunikasi, Jurnalistik
- Matematika+Fisika unggul → Teknik Sipil, Teknik Mesin, Teknik Elektro, Arsitektur, Teknik Geofisika
- Biologi+Kimia unggul → Kedokteran, Farmasi, Kedokteran Gigi, Keperawatan, Gizi, Biologi, Bioteknologi
- Matematika+Informatika unggul → Teknik Informatika, Sistem Informasi, Data Science, Ilmu Komputer, Cyber Security
- Ekonomi+Matematika unggul → Akuntansi, Manajemen, Ekonomi Pembangunan, Perbankan & Keuangan Digital, Bisnis Digital
- Bahasa Inggris+Geografi unggul → Hubungan Internasional, Pariwisata & Perhotelan, Sastra Inggris, Penerjemah
- Sosiologi+Sejarah unggul → Hukum, Administrasi Publik, Psikologi, Pendidikan, Kriminologi
- Seni Rupa unggul → Desain Komunikasi Visual, Seni Rupa Murni, Desain Interior, Animasi, Arsitektur
- Fisika+Kimia unggul → Teknik Kimia, Teknik Fisika, Ilmu Material, Geologi, Teknik Lingkungan
- Geografi+Ekonomi unggul → Perencanaan Wilayah & Kota, Geografi, Kajian Wilayah, Manajemen Sumber Daya Alam
- PPKn+Sejarah unggul → Ilmu Politik, Administrasi Negara, Hukum, Pendidikan PKn
- Bahasa Daerah+Sejarah unggul → Sastra Daerah, Antropologi, Pendidikan Bahasa Daerah, Filologi
- Informatika+Matematika → Teknik Informatika, Sistem Informasi, Data Science, Teknik Telekomunikasi
- PJOK+Biology → Ilmu Keolahragaan, Fisioterapi, Pendidikan Jasmani, Kesehatan Masyarakat
- Tren meningkat → jurusan terkait ditekankan. Tren menurun → catat perlu perhatian.

Jawab Bahasa Indonesia, format terstruktur.`
            },
            {
              role: 'user',
              content: `Analisis jurusan PT untuk siswa ini:

Nama: ${siswa.nama}
Kelas: ${siswa.rombel.kelas} | Rombel: ${siswa.rombel.nama} | Jurusan: ${siswa.rombel.jurusan}
Rata-rata: ${overallAvg.toFixed(1)} | Mapel Terbaik: ${topSubjects} | Perlu Ditingkatkan: ${bottomSubjects}

Nilai Rapor (tren: ↑naik ↓turun →stabil):
${nilaiSummary}
${tkaSummary}

Format jawaban:

## Kecenderungan Akademik
Analisis IPA/IPS berdasarkan nilai & tren

## Tren Perkembangan Nilai
- Meningkat: [mapel & implikasi]
- Menurun: [mapel & langkah perbaikan]
- Stabil: [mapel & konsistensi]

## Rekomendasi Jurusan (Top 7)
Untuk setiap jurusan:
- **Nama Jurusan** (Skor 1-100)
- Alasan cocok (hubungkan mapel unggulan & tren)
- Mapel pendukung & perlu ditingkatkan
- Prospek karir

## Analisis TKA (jika ada)
Interpretasi & kesesuaian dengan rekomendasi

## Strategi Masuk PTN
- PTN & fakultas realistis
- Jalur masuk (SNBP/SNBT/Mandiri)
- Tips meningkatkan peluang

## Kesimpulan
Top 3 jurusan terbaik & saran motivasi`
            }
          ],
          thinking: { type: 'disabled' }
        }),
        120000 // 120 second timeout per LLM call
      )

      const analysis = analysisResult.choices[0]?.message?.content

      if (!analysis || analysis.trim().length < 50) {
        throw new Error('AI menghasilkan respons kosong. Silakan coba lagi.')
      }

      return analysis
    }, 2, 2000) // Reduced to 2 retries to avoid extremely long waits

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[AI-Analysis] Completed for ${siswa.nama} in ${totalTime}s`)

    return NextResponse.json({
      siswaid,
      nama: siswa.nama,
      nis: siswa.nis,
      rombelNama: siswa.rombel.nama,
      kelas: siswa.rombel.kelas,
      analysis: result,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    console.error(`[AI-Analysis] Error after ${totalTime}s:`, errorMsg)

    // Return more specific error message
    let userMessage = 'Gagal menghasilkan analisis AI. Silakan coba lagi.'
    if (errorMsg.includes('LLM_TIMEOUT')) {
      userMessage = 'Analisis AI timeout (proses terlalu lama). Silakan coba lagi — jika masih gagal, coba siswa lain.'
    } else if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
      userMessage = 'Server AI sedang sibuk. Tunggu 1-2 menit lalu coba lagi.'
    } else if (errorMsg.includes('network') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('fetch failed')) {
      userMessage = 'Koneksi ke server AI gagal. Periksa jaringan dan coba lagi.'
    } else if (errorMsg.includes('All retries failed')) {
      userMessage = 'Analisis AI gagal setelah beberapa percobaan. Tunggu beberapa saat lalu coba lagi.'
    } else if (errorMsg.includes('kosong') || errorMsg.includes('empty')) {
      userMessage = 'AI menghasilkan respons kosong. Silakan coba lagi.'
    }

    return NextResponse.json({ error: userMessage, detail: errorMsg }, { status: 500 })
  }
}
