---
Task ID: 1
Agent: Main
Task: Investigate and fix why Kelas X students are dominantly classified as "Netral" in the Rekomendasi Jurusan (AI) analysis

Work Log:
- Analyzed the classification API at /api/analisa-jurusan/route.ts
- Found the root cause: the old algorithm used only the IPA-IPS weighted average gap with a ±2 threshold
- 60% of students (187/315) fell in the Netral zone because the gap distribution was very tight (mean gap = 0.7)
- All Kelas X students had zero trend data, so trendBonus never helped classification
- Subject-level analysis revealed clearer patterns: 207 students had more IPA subjects above average, 242 had IPA dominant top-3
- Implemented V2 Multi-Factor Classification Algorithm with 5 factors:
  1. Gap Score (20%): Weighted average gap between IPA and IPS
  2. Dominance Score (30%): How many IPA vs IPS subjects are above student's overall average
  3. Top-N Score (25%): How many of the top 3 scoring subjects are IPA vs IPS
  4. Strength Diff Score (15%): Difference between best IPA and best IPS subject
  5. Trend Score (10%): Semester trend differential
- Composite score is calculated with adjusted weights, threshold ±0.5 for Netral
- Netral classification reduced from 59.4% (187 students) to 33.7% (106 students)
- Remaining Netral students genuinely have conflicting signals between IPA and IPS
- Updated frontend to show multi-factor analysis visualization in student detail panel
- Added factorScores to AnalysisResult interface and FactorScores type

Stage Summary:
- V2 Multi-Factor Algorithm implemented in /api/analisa-jurusan/route.ts
- Frontend updated in /components/rekomendasi-jurusan-page.tsx with FactorScores type and multi-factor visualization
- Netral classification reduced from 59.4% to 33.7%
- 163 students now classified as IPA (was 89), 46 as IPS (was 39), 106 as Netral (was 187)
