import Link from "next/link"

export default function BottomTabBar() {
  return (
    <nav className="tab-bar" aria-label="하단 탭 메뉴">
      <Link href="/" className="tab-link">
        <div>🏠</div>
        <div>홈</div>
      </Link>
      <Link href="/menu" className="tab-link">
        <div>🍽️</div>
        <div>메뉴</div>
      </Link>
      <Link href="/settings" className="tab-link">
        <div>⚙️</div>
        <div>설정</div>
      </Link>
    </nav>
  )
}
