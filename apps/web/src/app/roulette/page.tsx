"use client"

import { useMemo, useState } from "react"

type RouletteCategory = "all" | "korean" | "chinese" | "japanese" | "western" | "fastfood" | "snack"

type RouletteResponse = {
  data: {
    selectedMenu: {
      id: string
      name: string
      category: string
      priceRange: string
      tags: string[]
    }
    nearbyRestaurant: {
      name: string
      distanceM: number
      isOpenNow: boolean
    } | null
    candidates: Array<{
      menuId: string
      menuName: string
      category: string
      distanceM: number | null
      isOpenNow: boolean | null
    }>
  }
  meta: {
    message: string
    totalCandidates: number
    nearbyMode: boolean
  }
}

const fallbackMenus = [
  { id: "menu-1", name: "김치찌개", category: "korean", priceRange: "8,000~10,000원", tags: ["국물", "든든"] },
  { id: "menu-2", name: "짜장면", category: "chinese", priceRange: "7,000~9,000원", tags: ["면", "빠른"] },
  { id: "menu-3", name: "초밥", category: "japanese", priceRange: "12,000~18,000원", tags: ["신선", "깔끔"] },
  { id: "menu-4", name: "파스타", category: "western", priceRange: "11,000~16,000원", tags: ["양식", "부드러운"] },
  { id: "menu-5", name: "햄버거", category: "fastfood", priceRange: "6,000~11,000원", tags: ["빠른", "가벼운"] },
  { id: "menu-6", name: "떡볶이", category: "snack", priceRange: "4,000~7,000원", tags: ["매콤", "분식"] },
]

const categoryOptions: Array<{ label: string; value: RouletteCategory }> = [
  { label: "전체", value: "all" },
  { label: "한식", value: "korean" },
  { label: "중식", value: "chinese" },
  { label: "일식", value: "japanese" },
  { label: "양식", value: "western" },
  { label: "패스트푸드", value: "fastfood" },
  { label: "분식", value: "snack" },
]

const radiusOptions = [500, 1000, 1500]

export default function RoulettePage() {
  const [category, setCategory] = useState<RouletteCategory>("all")
  const [radiusM, setRadiusM] = useState(1000)
  const [useNearby, setUseNearby] = useState(true)
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSpinning, setIsSpinning] = useState(false)
  const [spinText, setSpinText] = useState("룰렛 대기 중")
  const [result, setResult] = useState<RouletteResponse["data"] | null>(null)

  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL ?? "",
    [],
  )

  const getCurrentPosition = () => {
    return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("이 브라우저는 위치 기능을 지원하지 않아요."))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (geo) => {
          resolve({
            lat: geo.coords.latitude,
            lng: geo.coords.longitude,
          })
        },
        (err) => {
          reject(new Error(err.message || "위치 권한이 거부되었어요."))
        },
        {
          enableHighAccuracy: true,
          timeout: 7000,
        },
      )
    })
  }

  const spinNames = async (names: string[]) => {
    setIsSpinning(true)
    for (let i = 0; i < 12; i += 1) {
      const randomName = names[Math.floor(Math.random() * Math.max(names.length, 1))] ?? "메뉴 탐색 중"
      setSpinText(`🎯 ${randomName}`)
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 110 + i * 12))
    }
  }

  const spinNamesSafely = async (names: string[]) => {
    await Promise.race([
      spinNames(names),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ])
  }

  const runFallbackRoulette = async (requestedCategory: RouletteCategory) => {
    const pool = fallbackMenus.filter((menu) => requestedCategory === "all" || menu.category === requestedCategory)
    const candidates = pool.length > 0 ? pool : fallbackMenus

    await spinNamesSafely(candidates.map((menu) => menu.name))

    const selected = candidates[Math.floor(Math.random() * candidates.length)]

    setResult({
      selectedMenu: selected,
      nearbyRestaurant: null,
      candidates: candidates.map((menu) => ({
        menuId: menu.id,
        menuName: menu.name,
        category: menu.category,
        distanceM: null,
        isOpenNow: null,
      })),
    })
    setSpinText(`🎉 ${selected.name}`)
    setPermissionError("API 연결이 불안정해 임시 로컬 룰렛으로 추천했어요.")
  }

  const requestLocation = () => {
    setPermissionError(null)

    getCurrentPosition()
      .then((geo) => {
        setPosition(geo)
      })
      .catch((err) => {
        setPermissionError(err instanceof Error ? err.message : "위치 권한을 확인해 주세요.")
        setUseNearby(false)
      })
  }

  const runRoulette = async () => {
    setIsLoading(true)
    setResult(null)
    setPermissionError(null)

    let effectiveUseNearby = useNearby
    let effectivePosition = position

    let payload: Record<string, unknown> = {
      category,
      radiusM,
      useNearby: effectiveUseNearby,
      excludeMenuIds: [],
    }

    if (effectiveUseNearby && !effectivePosition) {
      try {
        effectivePosition = await getCurrentPosition()
        setPosition(effectivePosition)
      } catch (error) {
        effectiveUseNearby = false
        setUseNearby(false)
        setPermissionError(error instanceof Error ? `${error.message} 위치 기반 후보를 제외하고 진행할게요.` : "위치 확인 실패로 기본 모드로 진행할게요.")
      }
    }

    if (effectiveUseNearby && effectivePosition) {
      payload = {
        ...payload,
        useNearby: true,
        lat: effectivePosition.lat,
        lng: effectivePosition.lng,
      }
    } else {
      payload = {
        ...payload,
        useNearby: false,
      }
    }

    try {
      const response = await fetch(`${apiBase}/api/v1/recommend/roulette`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error("룰렛 API 요청이 실패했어요.")
      }

      const json = (await response.json()) as RouletteResponse
      const names = json.data.candidates.map((c) => c.menuName)

      await spinNamesSafely(names)

      setResult(json.data)
      setSpinText(`🎉 ${json.data.selectedMenu.name}`)
    } catch {
      await runFallbackRoulette(category)
    } finally {
      setIsSpinning(false)
      setIsLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <span className="badge">기능 2</span>
      <h1 className="page-title">위치 기반 랜덤 룰렛</h1>
      <p className="page-subtitle">내 주변 음식점 후보를 반영해 메뉴를 빠르게 정해요.</p>

      <section className="card">
        <div className="roulette-grid">
          <label className="roulette-label" htmlFor="category">카테고리</label>
          <select
            id="category"
            className="roulette-input"
            value={category}
            onChange={(e) => setCategory(e.target.value as RouletteCategory)}
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label className="roulette-label" htmlFor="radius">검색 반경</label>
          <select
            id="radius"
            className="roulette-input"
            value={radiusM}
            onChange={(e) => setRadiusM(Number(e.target.value))}
          >
            {radiusOptions.map((radius) => (
              <option key={radius} value={radius}>
                {radius}m
              </option>
            ))}
          </select>
        </div>

        <div className="roulette-row">
          <label className="roulette-check">
            <input
              type="checkbox"
              checked={useNearby}
              onChange={(e) => setUseNearby(e.target.checked)}
            />
            위치 기반 후보 사용
          </label>
          <button type="button" className="action-btn" onClick={requestLocation}>
            위치 권한 요청
          </button>
        </div>

        <p className="page-subtitle" style={{ marginTop: 10 }}>
          현재 위치: {position ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : "미확인"}
        </p>

        <button
          type="button"
          className="roulette-spin-btn"
          onClick={runRoulette}
          disabled={isLoading || isSpinning}
        >
          {isLoading || isSpinning ? "돌리는 중..." : "룰렛 돌리기"}
        </button>
      </section>

      <section className="card roulette-wheel" aria-live="polite">
        <p className="roulette-text">{spinText}</p>
      </section>

      {permissionError && (
        <section className="card">
          <p className="roulette-error">⚠️ {permissionError}</p>
        </section>
      )}

      {result && (
        <section className="card">
          <h3>최종 추천</h3>
          <p><strong>메뉴:</strong> {result.selectedMenu.name}</p>
          <p><strong>가격대:</strong> {result.selectedMenu.priceRange}</p>
          <p><strong>태그:</strong> {result.selectedMenu.tags.join(", ")}</p>
          {result.nearbyRestaurant ? (
            <>
              <p><strong>주변 음식점:</strong> {result.nearbyRestaurant.name}</p>
              <p>
                <strong>거리/영업:</strong> {result.nearbyRestaurant.distanceM}m · {result.nearbyRestaurant.isOpenNow ? "영업중" : "영업종료"}
              </p>
            </>
          ) : (
            <p className="page-subtitle">위치 기반 후보를 사용하지 않아 기본 후보로 추천했어요.</p>
          )}
        </section>
      )}
    </main>
  )
}
