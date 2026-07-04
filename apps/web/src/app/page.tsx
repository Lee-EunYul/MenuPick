import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="app-shell">
      <span className="badge">메뉴픽 MVP</span>
      <h1 className="page-title">오늘 뭐 먹지?</h1>
      <p className="page-subtitle">
        상황에 맞는 메뉴를 빠르게 결정할 수 있도록 도와줄게요.
      </p>

      <section className="card">
        <h3>빠른 시작</h3>
        <p className="page-subtitle">가장 많이 쓰는 기능으로 바로 이동해요.</p>
        <div className="actions">
          <Link href="/question" className="action-btn">📋 질문으로 추천받기</Link>
          <Link href="/roulette" className="action-btn">🎰 룰렛으로 빠르게 결정</Link>
        </div>
      </section>

      <section className="card">
        <h3>오늘의 안내</h3>
        <p className="page-subtitle">
          하단 탭에서 홈 · 메뉴 · 설정을 언제든 이동할 수 있습니다.
        </p>
      </section>
    </main>
  )
}
