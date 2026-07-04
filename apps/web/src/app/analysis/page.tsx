"use client"

import { useMemo, useState } from "react"

type AnalysisResponse = {
  data: {
    stats: {
      periodDays: number
      totalSelections: number
      acceptedCount: number
      acceptanceRate: number
      bySource: Record<string, number>
      byCategory: Record<string, number>
      topCategory: string | null
    }
    summary: {
      message: string
      topCategory: string | null
      recentPickCount: number
    }
    recommendations: Array<{
      id: string
      name: string
      category: string
      priceRange: string
      tags: string[]
      reason: string
    }>
  }
}

export default function AnalysisPage() {
  const [userId, setUserId] = useState("user-001")
  const [periodDays, setPeriodDays] = useState(30)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResponse["data"] | null>(null)

  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "", [])

  const loadAnalysis = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `${apiBase}/api/v1/recommend/analysis?userId=${encodeURIComponent(userId)}&periodDays=${periodDays}`,
      )

      if (!response.ok) {
        throw new Error("분석 API 호출에 실패했습니다.")
      }

      const json = (await response.json()) as AnalysisResponse
      setResult(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 중 오류가 발생했습니다.")
      setResult(null)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <span className="badge">기능 3</span>
      <h1 className="page-title">선택 이력 분석</h1>
      <p className="page-subtitle">최근 기록을 바탕으로 취향 통계와 개인화 메뉴를 추천해요.</p>

      <section className="card">
        <div className="analysis-grid">
          <label className="roulette-label" htmlFor="analysis-user">사용자 ID</label>
          <input
            id="analysis-user"
            className="roulette-input"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="예: user-001"
          />

          <label className="roulette-label" htmlFor="analysis-period">조회 기간</label>
          <select
            id="analysis-period"
            className="roulette-input"
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
          >
            <option value={7}>최근 7일</option>
            <option value={30}>최근 30일</option>
            <option value={60}>최근 60일</option>
          </select>
        </div>

        <button type="button" className="roulette-spin-btn" onClick={loadAnalysis} disabled={isLoading}>
          {isLoading ? "분석 중..." : "분석 추천 보기"}
        </button>
      </section>

      {error && (
        <section className="card">
          <p className="roulette-error">⚠️ {error}</p>
        </section>
      )}

      {result && (
        <>
          <section className="card">
            <h3>분석 요약</h3>
            <p className="page-subtitle" style={{ marginBottom: 10 }}>{result.summary.message}</p>
            <div className="analysis-stats-grid">
              <div className="analysis-stat-item">
                <strong>{result.stats.totalSelections}</strong>
                <span>총 선택 수</span>
              </div>
              <div className="analysis-stat-item">
                <strong>{result.stats.acceptanceRate}%</strong>
                <span>추천 수락률</span>
              </div>
              <div className="analysis-stat-item">
                <strong>{result.stats.topCategory ?? "없음"}</strong>
                <span>최다 카테고리</span>
              </div>
            </div>
          </section>

          <section className="card">
            <h3>추천 메뉴</h3>
            <div className="analysis-list">
              {result.recommendations.map((menu) => (
                <article key={menu.id} className="analysis-item">
                  <div className="analysis-item-top">
                    <strong>{menu.name}</strong>
                    <span>{menu.priceRange}</span>
                  </div>
                  <p className="page-subtitle" style={{ marginBottom: 8 }}>{menu.reason}</p>
                  <p className="analysis-tags">#{menu.tags.join(" #")}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
