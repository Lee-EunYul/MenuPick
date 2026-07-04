/**
 * selections.service.ts
 *
 * 선택 이력 저장/조회/통계를 처리하는 서비스
 * 현재는 DB 연결 전 단계라 메모리 배열에 저장한다.
 */

import { Injectable } from '@nestjs/common'
import { SAMPLE_MENUS } from '../database/seed-data'
import { CreateSelectionDto } from './dto/create-selection.dto'

interface SelectionRecord {
  id: string
  userId: string
  menuId: string
  source: 'question' | 'roulette' | 'ai_analysis'
  accepted: boolean
  selectedAt: string
}

@Injectable()
export class SelectionsService {
  private readonly records: SelectionRecord[] = []

  saveSelection(input: CreateSelectionDto) {
    const record: SelectionRecord = {
      id: `sel-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      userId: input.userId,
      menuId: input.menuId,
      source: input.source,
      accepted: input.accepted ?? true,
      selectedAt: new Date().toISOString(),
    }

    this.records.push(record)

    return {
      ...record,
      menu: this.findMenuSummary(record.menuId),
    }
  }

  getHistory(userId: string, from?: string, to?: string) {
    const fromDate = from ? new Date(from) : undefined
    const toDate = to ? new Date(to) : undefined

    const filtered = this.records
      .filter((r) => r.userId === userId)
      .filter((r) => {
        const d = new Date(r.selectedAt)
        if (fromDate && d < fromDate) return false
        if (toDate && d > toDate) return false
        return true
      })
      .sort((a, b) => new Date(b.selectedAt).getTime() - new Date(a.selectedAt).getTime())

    return filtered.map((r) => ({
      ...r,
      menu: this.findMenuSummary(r.menuId),
    }))
  }

  getStats(userId: string, periodDays = 30) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - periodDays)

    const userRecords = this.records.filter(
      (r) => r.userId === userId && new Date(r.selectedAt) >= cutoff,
    )

    const totalSelections = userRecords.length
    const acceptedCount = userRecords.filter((r) => r.accepted).length

    const bySource: Record<string, number> = {
      question: 0,
      roulette: 0,
      ai_analysis: 0,
    }

    const byCategory: Record<string, number> = {}

    for (const r of userRecords) {
      bySource[r.source] += 1
      const menu = SAMPLE_MENUS.find((m) => m.id === r.menuId)
      if (menu) {
        byCategory[menu.category] = (byCategory[menu.category] ?? 0) + 1
      }
    }

    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    return {
      periodDays,
      totalSelections,
      acceptedCount,
      acceptanceRate: totalSelections === 0 ? 0 : Number(((acceptedCount / totalSelections) * 100).toFixed(1)),
      bySource,
      byCategory,
      topCategory,
    }
  }

  /**
   * 거절한 메뉴 ID 목록 조회 (3번 이상 거절한 메뉴는 제외 대상)
   */
  getRejectedMenuIds(userId: string, periodDays = 30): string[] {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - periodDays)

    const rejectionCount: Record<string, number> = {}

    for (const r of this.records) {
      if (r.userId !== userId) continue
      if (new Date(r.selectedAt) < cutoff) continue
      if (r.accepted) continue

      rejectionCount[r.menuId] = (rejectionCount[r.menuId] ?? 0) + 1
    }

    // 3번 이상 거절한 메뉴만 제외 리스트에 추가
    return Object.entries(rejectionCount)
      .filter(([_, count]) => count >= 3)
      .map(([menuId, _]) => menuId)
  }

  /**
   * 최근 선택한 메뉴 ID 목록 (고도화 추천 시 중복 방지용)
   */
  getRecentMenuIds(userId: string, count = 10): string[] {
    const recent = this.records
      .filter((r) => r.userId === userId && r.accepted)
      .sort((a, b) => new Date(b.selectedAt).getTime() - new Date(a.selectedAt).getTime())
      .slice(0, count)
      .map((r) => r.menuId)

    return recent
  }

  /**
   * 선택 패턴 분석 (매운맛, 카테고리, 가격대 선호도)
   */
  getSelectionPatterns(userId: string, periodDays = 30) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - periodDays)

    const userRecords = this.records.filter(
      (r) => r.userId === userId && new Date(r.selectedAt) >= cutoff && r.accepted,
    )

    if (userRecords.length === 0) {
      return {
        avgSpicyLevel: 0,
        categoryPreference: {},
        avgPrice: 0,
        priceDistribution: 'balanced',
      }
    }

    // 매운맛 평균
    let totalSpicy = 0
    let spicyCount = 0
    const categoryPref: Record<string, number> = {}
    let totalPrice = 0

    for (const r of userRecords) {
      const menu = SAMPLE_MENUS.find((m) => m.id === r.menuId)
      if (!menu) continue

      totalSpicy += menu.spicyLevel
      spicyCount++

      categoryPref[menu.category] = (categoryPref[menu.category] ?? 0) + 1

      totalPrice += (menu.priceMin + menu.priceMax) / 2
    }

    const avgSpicyLevel = Number((totalSpicy / Math.max(spicyCount, 1)).toFixed(1))
    const avgPrice = Math.floor(totalPrice / userRecords.length)

    // 가격대 분류
    let priceDistribution = 'balanced'
    if (avgPrice < 10000) priceDistribution = 'cheap'
    else if (avgPrice > 20000) priceDistribution = 'expensive'

    return {
      avgSpicyLevel,
      categoryPreference: categoryPref,
      avgPrice,
      priceDistribution,
    }
  }

  private findMenuSummary(menuId: string) {
    const menu = SAMPLE_MENUS.find((m) => m.id === menuId)
    if (!menu) return null

    return {
      id: menu.id,
      name: menu.name,
      category: menu.category,
      priceRange: `${menu.priceMin.toLocaleString()}~${menu.priceMax.toLocaleString()}원`,
    }
  }

  hasMenu(menuId: string) {
    return SAMPLE_MENUS.some((m) => m.id === menuId)
  }
}
