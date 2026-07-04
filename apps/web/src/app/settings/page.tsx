'use client'

import { useState, useEffect } from 'react'

const CATEGORIES = ['한식', '중식', '일식', '양식', '패스트푸드', '분식']
const SPICY_LEVELS = [
  { value: 0, label: '순한맛' },
  { value: 1, label: '약간 매운맛' },
  { value: 2, label: '중간 매운맛' },
  { value: 3, label: '매우 매운맛' },
]

interface UserSettings {
  userId: string
  maxSpicyLevel: number
  preferredCategories: string[]
  notificationTime1: string
  notificationTime2: string
  locationPermission: boolean
}

const DEFAULT_SETTINGS: UserSettings = {
  userId: 'user-001',
  maxSpicyLevel: 2,
  preferredCategories: ['한식', '양식'],
  notificationTime1: '12:00',
  notificationTime2: '18:00',
  locationPermission: false,
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [isMounted, setIsMounted] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    // 로컬스토리지에서 설정값 로드
    const saved = localStorage.getItem('userSettings')
    if (saved) {
      setSettings(JSON.parse(saved))
    }
    setIsMounted(true)
  }, [])

  const handleSaveSettings = () => {
    localStorage.setItem('userSettings', JSON.stringify(settings))
    setSaveMessage('설정이 저장되었어요!')
    setTimeout(() => setSaveMessage(''), 3000)
  }

  const handleCategoryToggle = (category: string) => {
    setSettings(prev => ({
      ...prev,
      preferredCategories: prev.preferredCategories.includes(category)
        ? prev.preferredCategories.filter(c => c !== category)
        : [...prev.preferredCategories, category]
    }))
  }

  const handleResetData = () => {
    const confirmed = window.confirm(
      '정말 모든 선택 기록을 초기화하시겠어요?\n이 작업은 되돌릴 수 없습니다.'
    )
    if (confirmed) {
      localStorage.removeItem('userSelections')
      alert('선택 기록이 초기화되었어요!')
    }
  }

  const handleCheckLocationPermission = async () => {
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' })
      setSettings(prev => ({
        ...prev,
        locationPermission: permission.state === 'granted'
      }))
    } catch (error) {
      console.error('위치 권한 확인 실패:', error)
    }
  }

  if (!isMounted) return null

  return (
    <main className="app-shell">
      <h1 className="page-title">설정</h1>
      <p className="page-subtitle">당신의 선호도와 알림을 설정할 수 있어요.</p>

      {/* 사용자 ID */}
      <section className="card">
        <h3>👤 사용자 ID</h3>
        <p className="page-subtitle">분석 데이터를 불러올 때 사용돼요.</p>
        <div className="settings-input-group">
          <input
            type="text"
            value={settings.userId}
            onChange={e => setSettings(prev => ({ ...prev, userId: e.target.value }))}
            className="settings-input"
            placeholder="사용자 ID 입력"
          />
        </div>
      </section>

      {/* 매운맛 선호도 */}
      <section className="card">
        <h3>🌶️ 매운맛 선호도</h3>
        <p className="page-subtitle">가장 매운 메뉴의 기준을 설정해요.</p>
        <div className="settings-radio-group">
          {SPICY_LEVELS.map(level => (
            <label key={level.value} className="settings-radio-label">
              <input
                type="radio"
                name="spicy"
                value={level.value}
                checked={settings.maxSpicyLevel === level.value}
                onChange={e => setSettings(prev => ({ ...prev, maxSpicyLevel: parseInt(e.target.value) }))}
              />
              <span>{level.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* 카테고리 선호도 */}
      <section className="card">
        <h3>🍽️ 카테고리 선호도</h3>
        <p className="page-subtitle">좋아하는 음식 종류를 선택해요 (여러 개 가능)</p>
        <div className="settings-checkbox-group">
          {CATEGORIES.map(category => (
            <label key={category} className="settings-checkbox-label">
              <input
                type="checkbox"
                checked={settings.preferredCategories.includes(category)}
                onChange={() => handleCategoryToggle(category)}
              />
              <span>{category}</span>
            </label>
          ))}
        </div>
      </section>

      {/* 알림 설정 */}
      <section className="card">
        <h3>🔔 알림 설정</h3>
        <p className="page-subtitle">점심과 저녁 추천 알림 시간</p>
        <div className="settings-time-group">
          <div className="settings-time-item">
            <label>점심 알림</label>
            <input
              type="time"
              value={settings.notificationTime1}
              onChange={e => setSettings(prev => ({ ...prev, notificationTime1: e.target.value }))}
              className="settings-time-input"
            />
          </div>
          <div className="settings-time-item">
            <label>저녁 알림</label>
            <input
              type="time"
              value={settings.notificationTime2}
              onChange={e => setSettings(prev => ({ ...prev, notificationTime2: e.target.value }))}
              className="settings-time-input"
            />
          </div>
        </div>
      </section>

      {/* 위치 권한 */}
      <section className="card">
        <h3>📍 위치 권한</h3>
        <p className="page-subtitle">룰렛에서 근처 음식점을 찾을 때 필요해요.</p>
        <div className="settings-permission-status">
          <span className={`permission-badge ${settings.locationPermission ? 'granted' : 'not-granted'}`}>
            {settings.locationPermission ? '✓ 허용됨' : '✗ 미허용'}
          </span>
          <button
            onClick={handleCheckLocationPermission}
            className="action-btn"
            style={{ marginTop: '12px' }}
          >
            권한 확인하기
          </button>
        </div>
      </section>

      {/* 저장 버튼 */}
      <section style={{ marginBottom: '100px' }}>
        <button
          onClick={handleSaveSettings}
          className="action-btn"
          style={{ width: '100%', backgroundColor: '#0f766e' }}
        >
          💾 설정 저장하기
        </button>
        {saveMessage && (
          <p style={{ textAlign: 'center', color: '#0f766e', marginTop: '12px', fontWeight: 'bold' }}>
            {saveMessage}
          </p>
        )}
      </section>

      {/* 데이터 초기화 */}
      <section className="card" style={{ marginBottom: '100px' }}>
        <h3>⚠️ 데이터 관리</h3>
        <p className="page-subtitle">신중하게 사용하세요. 되돌릴 수 없습니다.</p>
        <button
          onClick={handleResetData}
          className="action-btn"
          style={{ backgroundColor: '#dc2626', width: '100%' }}
        >
          🗑️ 선택 기록 초기화
        </button>
      </section>

      {/* 버전 정보 */}
      <section className="card" style={{ marginBottom: '120px' }}>
        <h3>ℹ️ 앱 정보</h3>
        <div style={{ color: '#666', fontSize: '14px', lineHeight: '1.6' }}>
          <p><strong>메뉴픽 (Menu Pick)</strong></p>
          <p>버전: 1.0.0</p>
          <p>빌드: 2026-06-13</p>
          <p style={{ marginTop: '8px', color: '#999' }}>당신의 취향을 학습하는 메뉴 추천 앱</p>
        </div>
      </section>
    </main>
  )
}
