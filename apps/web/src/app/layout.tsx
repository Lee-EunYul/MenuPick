import type { Metadata } from 'next'
import BottomTabBar from '../components/bottom-tab-bar'
import './globals.css'

export const metadata: Metadata = {
  title: '메뉴픽 - 오늘 뭐 먹지?',
  description: '상황에 맞는 메뉴를 빠르게 결정해드립니다',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>
        {children}
        <BottomTabBar />
      </body>
    </html>
  )
}
