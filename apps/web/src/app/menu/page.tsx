import Link from "next/link"

export default function MenuPage() {
  return (
    <main className="app-shell">
      <h1 className="page-title">메뉴 기능</h1>
      <p className="page-subtitle">원하는 방식으로 메뉴를 추천받아보세요.</p>

      <section className="actions">
        <Link href="/question" className="card action-btn">
          📋 질문 기반 맞춤 추천
        </Link>
        <Link href="/roulette" className="card action-btn">
          🎰 위치 기반 랜덤 룰렛
        </Link>
        <Link href="/analysis" className="card action-btn">
          📊 선택 이력 분석 추천
        </Link>
      </section>
    </main>
  )
}
