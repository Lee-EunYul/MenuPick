/**
 * create-selection.dto.ts
 *
 * 선택 기록 저장 요청 형식
 */

export type SelectionSource = 'question' | 'roulette' | 'ai_analysis'

export interface CreateSelectionDto {
  userId: string
  menuId: string
  source: SelectionSource
  accepted?: boolean
}

export interface HistoryQueryDto {
  userId: string
  from?: string
  to?: string
}

export interface StatsQueryDto {
  userId: string
  periodDays?: string
}
