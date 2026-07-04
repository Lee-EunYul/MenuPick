import { SAMPLE_MENUS } from './seed-data'

export type SelectionSource = 'question' | 'roulette' | 'ai_analysis'

export interface CreateSelectionDto {
  userId: string
  menuId: string
  source: SelectionSource
  accepted?: boolean
}

interface SelectionRecord {
  id: string
  userId: string
  menuId: string
  source: SelectionSource
  accepted: boolean
  selectedAt: string
}

export class SelectionsService {
  private readonly records: SelectionRecord[] = []

  hasMenu(menuId: string) {
    return SAMPLE_MENUS.some((m) => m.id === menuId)
  }

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
    return { ...record, menu: this.findMenuSummary(record.menuId) }
  }

  getHistory(userId: string, from?: string, to?: string) {
    const fromDate = from ? new Date(from) : undefined
    const toDate = to ? new Date(to) : undefined
    return this.records
      .filter((r) => r.userId === userId)
      .filter((r) => {
        const d = new Date(r.selectedAt)
        if (fromDate && d < fromDate) return false
        if (toDate && d > toDate) return false
        return true
      })
      .sort((a, b) => new Date(b.selectedAt).getTime() - new Date(a.selectedAt).getTime())
      .map((r) => ({ ...r, menu: this.findMenuSummary(r.menuId) }))
  }

  getStats(userId: string, periodDays = 30) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - periodDays)
    const userRecords = this.records.filter(
      (r) => r.userId === userId && new Date(r.selectedAt) >= cutoff,
    )

    const totalSelections = userRecords.length
    const acceptedCount = userRecords.filter((r) => r.accepted).length
    const bySource: Record<string, number> = { question: 0, roulette: 0, ai_analysis: 0 }
    const byCategory: Record<string, number> = {}

    for (const r of userRecords) {
      bySource[r.source] += 1
      const menu = SAMPLE_MENUS.find((m) => m.id === r.menuId)
      if (menu) byCategory[menu.category] = (byCategory[menu.category] ?? 0) + 1
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

  getRejectedMenuIds(userId: string, periodDays = 30): string[] {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - periodDays)
    const rejectionCount: Record<string, number> = {}
    for (const r of this.records) {
      if (r.userId !== userId || new Date(r.selectedAt) < cutoff || r.accepted) continue
      rejectionCount[r.menuId] = (rejectionCount[r.menuId] ?? 0) + 1
    }
    return Object.entries(rejectionCount).filter(([, count]) => count >= 3).map(([id]) => id)
  }

  getRecentMenuIds(userId: string, count = 10): string[] {
    return this.records
      .filter((r) => r.userId === userId && r.accepted)
      .sort((a, b) => new Date(b.selectedAt).getTime() - new Date(a.selectedAt).getTime())
      .slice(0, count)
      .map((r) => r.menuId)
  }

  private findMenuSummary(menuId: string) {
    const menu = SAMPLE_MENUS.find((m) => m.id === menuId)
    if (!menu) return null
    return { id: menu.id, name: menu.name, category: menu.category, priceRange: `${menu.priceMin.toLocaleString()}~${menu.priceMax.toLocaleString()}원` }
  }
}
