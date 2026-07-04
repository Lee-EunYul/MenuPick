"use client"

import { useEffect, useMemo, useState } from "react"

type BudgetLevel = "cheap" | "mid" | "high"
type SpicyPreference = "none" | "little" | "medium" | "hot"
type BrothPreference = "yes" | "no" | "any"
type DiningStyle = "solo" | "group" | "any"
type CategoryPreference = "korean" | "chinese" | "japanese" | "western" | "fastfood" | "snack" | "any"

type QuestionAnswers = {
  budget: BudgetLevel
  spicy: SpicyPreference
  broth: BrothPreference
  diningStyle: DiningStyle
  category: CategoryPreference
}

type QuestionResultResponse = {
  data: Array<{
    id: string
    name: string
    category: string
    priceRange: string
    tags: string[]
    reasons: string[]
  }>
  meta: {
    message: string
    totalCandidates: number
  }
}

type UserSettings = {
  userId?: string
}

type SelectionSaveResponse = {
  data: {
    id: string
    userId: string
    menuId: string
    source: "question" | "roulette" | "ai_analysis"
    accepted: boolean
    selectedAt: string
  }
  meta: {
    message: string
  }
}

const DRAFT_KEY = "question_answers_draft_v1"

const defaultAnswers: QuestionAnswers = {
  budget: "cheap",
  spicy: "little",
  broth: "any",
  diningStyle: "solo",
  category: "any",
}

const questionTitles = ["예산", "매운맛", "국물", "식사 인원", "카테고리"] as const

const answerLabels = {
  budget: {
    cheap: "1만원 이하",
    mid: "1만원 ~ 2만원",
    high: "2만원 이상",
  },
  spicy: {
    none: "안 매움",
    little: "약간 매움",
    medium: "보통 매움",
    hot: "매우 매움",
  },
  broth: {
    yes: "국물 있음",
    no: "국물 없음",
    any: "상관 없음",
  },
  diningStyle: {
    solo: "혼밥",
    group: "모임",
    any: "상관 없음",
  },
  category: {
    korean: "한식",
    chinese: "중식",
    japanese: "일식",
    western: "양식",
    fastfood: "패스트푸드",
    snack: "분식",
    any: "전체",
  },
}

export default function QuestionPage() {
  const [answers, setAnswers] = useState<QuestionAnswers>(defaultAnswers)
  const [currentStep, setCurrentStep] = useState(0)
  const [userId, setUserId] = useState("user-001")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [historyMessage, setHistoryMessage] = useState<string | null>(null)
  const [savingMenuId, setSavingMenuId] = useState<string | null>(null)
  const [results, setResults] = useState<QuestionResultResponse["data"]>([])

  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "", [])

  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY)
    if (!draft) return

    try {
      const parsed = JSON.parse(draft) as Partial<QuestionAnswers>
      setAnswers((prev) => ({ ...prev, ...parsed }))
    } catch {
      localStorage.removeItem(DRAFT_KEY)
    }
  }, [])

  useEffect(() => {
    const settingsRaw = localStorage.getItem("userSettings")
    if (!settingsRaw) return

    try {
      const parsed = JSON.parse(settingsRaw) as UserSettings
      if (parsed.userId && parsed.userId.trim().length > 0) {
        setUserId(parsed.userId.trim())
      }
    } catch {
      // Ignore malformed settings payload and keep fallback userId.
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(answers))
  }, [answers])

  const updateAnswer = <K extends keyof QuestionAnswers>(key: K, value: QuestionAnswers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  const goPrevStep = () => setCurrentStep((prev) => Math.max(0, prev - 1))
  const goNextStep = () => setCurrentStep((prev) => Math.min(questionTitles.length - 1, prev + 1))

  const requestRecommendation = async () => {
    setIsLoading(true)
    setError(null)
    setMessage(null)
    setHistoryMessage(null)
    setResults([])

    try {
      const response = await fetch(`${apiBase}/api/v1/recommend/question`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(answers),
      })

      if (!response.ok) {
        throw new Error("추천 요청에 실패했어요. 잠시 후 다시 시도해 주세요.")
      }

      const json = (await response.json()) as QuestionResultResponse
      setResults(json.data)
      setMessage(json.meta.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : "추천 중 오류가 발생했어요.")
    } finally {
      setIsLoading(false)
    }
  }

  const resetToSavingDefault = () => {
    setAnswers(defaultAnswers)
    setCurrentStep(0)
    setResults([])
    setMessage("절약 우선 기본값으로 되돌렸어요.")
    setHistoryMessage(null)
    setError(null)
  }

  const saveSelectionHistory = async (menuId: string, accepted: boolean) => {
    setSavingMenuId(menuId)
    setError(null)

    try {
      const response = await fetch(`${apiBase}/api/v1/selections`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          menuId,
          source: "question",
          accepted,
        }),
      })

      if (!response.ok) {
        throw new Error("선택 기록 저장에 실패했어요.")
      }

      const json = (await response.json()) as SelectionSaveResponse
      setHistoryMessage(
        accepted
          ? `선택 기록 저장 완료: ${json.data.menuId} (개인화 추천에 반영됩니다)`
          : `패스 기록 저장 완료: ${json.data.menuId} (다음 추천 품질 향상에 사용됩니다)`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "선택 기록 저장 중 오류가 발생했어요.")
    } finally {
      setSavingMenuId(null)
    }
  }

  const progressPct = ((currentStep + 1) / questionTitles.length) * 100

  const answerSummary = [
    `예산: ${answerLabels.budget[answers.budget]}`,
    `매운맛: ${answerLabels.spicy[answers.spicy]}`,
    `국물: ${answerLabels.broth[answers.broth]}`,
    `식사 인원: ${answerLabels.diningStyle[answers.diningStyle]}`,
    `카테고리: ${answerLabels.category[answers.category]}`,
  ]

  return (
    <main className="app-shell">
      <span className="badge">기능 1</span>
      <h1 className="page-title">질문 기반 맞춤 추천</h1>
      <p className="page-subtitle">질문 5개에 답하면 현재 상황에 맞는 메뉴를 추천해요.</p>

      <section className="card">
        <div className="question-progress-wrap" aria-hidden="true">
          <div className="question-progress-bar" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="question-step-label">질문 {currentStep + 1} / {questionTitles.length}: {questionTitles[currentStep]}</p>

        <p className="question-tip">
          절약 우선 모드: 기본값이 저예산으로 설정되어 있어요. 빠르게 추천받고 싶으면 바로 버튼을 눌러도 됩니다.
        </p>
        <p className="question-user">개인화 기준 사용자 ID: <strong>{userId}</strong></p>

        <div className={`question-block ${currentStep === 0 ? "is-active" : "is-hidden"}`}>
          <p className="roulette-label">1) 예산</p>
          <div className="question-options">
            <label className="settings-radio-label">
              <input
                type="radio"
                name="budget"
                checked={answers.budget === "cheap"}
                onChange={() => updateAnswer("budget", "cheap")}
              />
              1만원 이하 (절약 우선)
            </label>
            <label className="settings-radio-label">
              <input
                type="radio"
                name="budget"
                checked={answers.budget === "mid"}
                onChange={() => updateAnswer("budget", "mid")}
              />
              1만원 ~ 2만원
            </label>
            <label className="settings-radio-label">
              <input
                type="radio"
                name="budget"
                checked={answers.budget === "high"}
                onChange={() => updateAnswer("budget", "high")}
              />
              2만원 이상
            </label>
          </div>
        </div>

        <div className={`question-block ${currentStep === 1 ? "is-active" : "is-hidden"}`}>
          <p className="roulette-label">2) 매운맛</p>
          <div className="question-options">
            <label className="settings-radio-label"><input type="radio" name="spicy" checked={answers.spicy === "none"} onChange={() => updateAnswer("spicy", "none")} /> 안 매움</label>
            <label className="settings-radio-label"><input type="radio" name="spicy" checked={answers.spicy === "little"} onChange={() => updateAnswer("spicy", "little")} /> 약간 매움</label>
            <label className="settings-radio-label"><input type="radio" name="spicy" checked={answers.spicy === "medium"} onChange={() => updateAnswer("spicy", "medium")} /> 보통 매움</label>
            <label className="settings-radio-label"><input type="radio" name="spicy" checked={answers.spicy === "hot"} onChange={() => updateAnswer("spicy", "hot")} /> 매우 매움</label>
          </div>
        </div>

        <div className={`question-block ${currentStep === 2 ? "is-active" : "is-hidden"}`}>
          <p className="roulette-label">3) 국물</p>
          <div className="question-options">
            <label className="settings-radio-label"><input type="radio" name="broth" checked={answers.broth === "yes"} onChange={() => updateAnswer("broth", "yes")} /> 국물 있는 메뉴</label>
            <label className="settings-radio-label"><input type="radio" name="broth" checked={answers.broth === "no"} onChange={() => updateAnswer("broth", "no")} /> 국물 없는 메뉴</label>
            <label className="settings-radio-label"><input type="radio" name="broth" checked={answers.broth === "any"} onChange={() => updateAnswer("broth", "any")} /> 상관 없음</label>
          </div>
        </div>

        <div className={`question-block ${currentStep === 3 ? "is-active" : "is-hidden"}`}>
          <p className="roulette-label">4) 식사 인원</p>
          <div className="question-options">
            <label className="settings-radio-label"><input type="radio" name="diningStyle" checked={answers.diningStyle === "solo"} onChange={() => updateAnswer("diningStyle", "solo")} /> 혼밥</label>
            <label className="settings-radio-label"><input type="radio" name="diningStyle" checked={answers.diningStyle === "group"} onChange={() => updateAnswer("diningStyle", "group")} /> 모임</label>
            <label className="settings-radio-label"><input type="radio" name="diningStyle" checked={answers.diningStyle === "any"} onChange={() => updateAnswer("diningStyle", "any")} /> 상관 없음</label>
          </div>
        </div>

        <div className={`question-block ${currentStep === 4 ? "is-active" : "is-hidden"}`}>
          <p className="roulette-label">5) 카테고리</p>
          <select
            className="roulette-input"
            value={answers.category}
            onChange={(e) => updateAnswer("category", e.target.value as CategoryPreference)}
          >
            <option value="any">전체</option>
            <option value="korean">한식</option>
            <option value="chinese">중식</option>
            <option value="japanese">일식</option>
            <option value="western">양식</option>
            <option value="fastfood">패스트푸드</option>
            <option value="snack">분식</option>
          </select>
        </div>

        <div className="question-nav">
          <button type="button" className="action-btn question-nav-btn" onClick={goPrevStep} disabled={currentStep === 0 || isLoading}>
            이전
          </button>
          <button type="button" className="action-btn question-nav-btn" onClick={goNextStep} disabled={currentStep === questionTitles.length - 1 || isLoading}>
            다음
          </button>
        </div>

        <div className="question-summary">
          {answerSummary.map((line) => (
            <span key={line} className="question-chip">{line}</span>
          ))}
        </div>

        <div className="roulette-row">
          <button type="button" className="action-btn" onClick={resetToSavingDefault}>절약 기본값으로 초기화</button>
          <button type="button" className="roulette-spin-btn" onClick={requestRecommendation} disabled={isLoading}>
            {isLoading ? "추천 계산 중..." : "질문 기반 추천 받기"}
          </button>
        </div>
      </section>

      {message && (
        <section className="card">
          <p className="page-subtitle" style={{ marginBottom: 0 }}>{message}</p>
        </section>
      )}

      {historyMessage && (
        <section className="card">
          <p className="question-history-ok">✅ {historyMessage}</p>
        </section>
      )}

      {error && (
        <section className="card">
          <p className="roulette-error">⚠️ {error}</p>
        </section>
      )}

      {results.length > 0 && (
        <section className="card">
          <h3 style={{ marginTop: 0 }}>추천 결과</h3>
          <div className="analysis-list">
            {results.map((item) => (
              <article key={item.id} className="analysis-item">
                <div className="analysis-item-top">
                  <strong>{item.name}</strong>
                  <span>{item.priceRange}</span>
                </div>
                <p className="analysis-tags">#{item.category} · {item.tags.join(" · ")}</p>
                <p className="page-subtitle" style={{ margin: 0 }}>추천 이유: {item.reasons.join(" / ")}</p>
                <div className="question-result-actions">
                  <button
                    type="button"
                    className="action-btn"
                    disabled={savingMenuId === item.id}
                    onClick={() => saveSelectionHistory(item.id, true)}
                  >
                    {savingMenuId === item.id ? "저장 중..." : "이 메뉴 선택"}
                  </button>
                  <button
                    type="button"
                    className="action-btn question-pass-btn"
                    disabled={savingMenuId === item.id}
                    onClick={() => saveSelectionHistory(item.id, false)}
                  >
                    패스
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
