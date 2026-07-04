/**
 * recommendation.service.ts
 *
 * 핵심 추천 로직이 들어있는 서비스
 * "서비스" = 실제 계산/처리를 담당하는 주방장 역할
 *
 * 흐름:
 * 1. 답변을 조건으로 변환
 * 2. 조건에 맞지 않는 메뉴 제거 (하드 필터)
 * 3. 남은 메뉴에 점수 계산 (소프트 점수)
 * 4. 점수 높은 순으로 Top 3 반환
 */

import { Injectable } from '@nestjs/common'
import { SAMPLE_MENUS, Menu } from '../database/seed-data'
import {
  QuestionAnswerDto,
  BudgetLevel,
  SpicyPreference,
} from './dto/question-answer.dto'
import { NearbyRestaurantItem, RouletteRequestDto } from './dto/roulette-request.dto'
import { SelectionsService } from '../selections/selections.service'

export interface UserSettings {
  userId: string
  maxSpicyLevel: number
  preferredCategories: string[]
}

export interface PersonalizedRecommendationResult {
  recommendations: Array<{
    id: string
    name: string
    category: string
    priceRange: string
    tags: string[]
    score: number
    reasoning: string
  }>
  personalizationFactors: {
    settingsApplied: string[]
    patternAnalysis: {
      avgSpicyLevel: number
      preferredCategory: string | null
      avgPrice: number
    }
    excludedCount: number
  }
}

export interface RecommendedMenu {
  id: string
  name: string
  category: string
  priceMin: number
  priceMax: number
  tags: string[]
  score: number
  reasons: string[]  // 추천 이유 목록
}

export interface RouletteResult {
  selectedMenu: {
    id: string
    name: string
    category: string
    priceRange: string
    tags: string[]
  }
  nearbyRestaurant: NearbyRestaurantItem | null
  candidates: Array<{
    menuId: string
    menuName: string
    category: string
    distanceM: number | null
    isOpenNow: boolean | null
  }>
}

export interface AnalysisRecommendationResult {
  recommendations: Array<{
    id: string
    name: string
    category: string
    priceRange: string
    tags: string[]
    reason: string
  }>
  summary: {
    message: string
    topCategory: string | null
    recentPickCount: number
  }
}

@Injectable()
export class RecommendationService {
  constructor(private readonly selectionsService: SelectionsService) {}

  // ─── 메인 추천 함수 ────────────────────────────────────────
  recommend(answers: QuestionAnswerDto): RecommendedMenu[] {
    // 1단계: 하드 필터 — 조건에 완전히 어긋나는 메뉴 제거
    const filtered = this.hardFilter(SAMPLE_MENUS, answers)

    // 2단계: 점수 계산 — 조건에 얼마나 잘 맞는지 숫자로 평가
    const scored = filtered.map((menu) => this.scoreMenu(menu, answers))

    // 3단계: 점수 높은 순으로 정렬 후 Top 3 반환
    return scored
      .sort((a, b) => {
        const scoreDiff = b.score - a.score
        if (scoreDiff !== 0) return scoreDiff
        return this.compareByTieBreaker(a, b, answers)
      })
      .slice(0, 3)
  }

  /**
   * 사용자 설정 + 선택 패턴을 반영한 고도화 추천
   * (개인화 추천 고도화)
   */
  getPersonalizedRecommendations(
    userId: string,
    settings: UserSettings,
    periodDays = 30,
    count = 5,
  ): PersonalizedRecommendationResult {
    // 1단계: 제외할 메뉴 수집
    const rejectedMenuIds = this.selectionsService.getRejectedMenuIds(userId, periodDays)
    const recentMenuIds = this.selectionsService.getRecentMenuIds(userId, 10)
    const excludeSet = new Set([...rejectedMenuIds, ...recentMenuIds])

    // 2단계: 선택 패턴 분석
    const patterns = this.selectionsService.getSelectionPatterns(userId, periodDays)

    // 3단계: 필터링 + 점수 계산
    let candidates = SAMPLE_MENUS
      .filter((m) => !excludeSet.has(m.id))  // 제외 메뉴 필터
      .map((menu) =>
        this.scoreMenuPersonalized(
          menu,
          settings,
          patterns,
        ),
      )

    // 4단계: 정렬 후 상위 N개 반환
    const recommendations = candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map((rec) => ({
        id: rec.id,
        name: rec.name,
        category: rec.category,
        priceRange: `${rec.priceMin.toLocaleString()}~${rec.priceMax.toLocaleString()}원`,
        tags: rec.tags,
        score: rec.score,
        reasoning: rec.reasoning,
      }))

    const settingsApplied = this.describeSettings(settings)

    return {
      recommendations,
      personalizationFactors: {
        settingsApplied,
        patternAnalysis: {
          avgSpicyLevel: patterns.avgSpicyLevel,
          preferredCategory: Object.entries(patterns.categoryPreference).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
          avgPrice: patterns.avgPrice,
        },
        excludedCount: excludeSet.size,
      },
    }
  }

  spinRoulette(input: RouletteRequestDto): RouletteResult {
    const category = input.category ?? 'all'
    const excludeIds = new Set(input.excludeMenuIds ?? [])

    const baseMenus = SAMPLE_MENUS.filter((m) => {
      if (excludeIds.has(m.id)) return false
      if (category !== 'all' && m.category !== category) return false
      return true
    })

    if (baseMenus.length === 0) {
      throw new Error('조건에 맞는 룰렛 후보 메뉴가 없습니다.')
    }

    const nearbyEnabled = input.useNearby === true && typeof input.lat === 'number' && typeof input.lng === 'number'

    const nearbyRestaurants = nearbyEnabled
      ? this.getNearbyRestaurants(input.lat!, input.lng!, input.radiusM ?? 1000, category)
      : []

    const candidates = baseMenus.map((menu, index) => {
      const nearby = nearbyRestaurants[index % Math.max(nearbyRestaurants.length, 1)]

      return {
        menu,
        nearby: nearbyRestaurants.length > 0 ? nearby : null,
      }
    })

    const winner = candidates[Math.floor(Math.random() * candidates.length)]

    return {
      selectedMenu: {
        id: winner.menu.id,
        name: winner.menu.name,
        category: winner.menu.category,
        priceRange: `${winner.menu.priceMin.toLocaleString()}~${winner.menu.priceMax.toLocaleString()}원`,
        tags: winner.menu.tags,
      },
      nearbyRestaurant: winner.nearby,
      candidates: candidates.map((c) => ({
        menuId: c.menu.id,
        menuName: c.menu.name,
        category: c.menu.category,
        distanceM: c.nearby?.distanceM ?? null,
        isOpenNow: c.nearby?.isOpenNow ?? null,
      })),
    }
  }

  getNearbyRestaurants(
    lat: number,
    lng: number,
    radiusM = 1000,
    category: RouletteRequestDto['category'] = 'all',
  ): NearbyRestaurantItem[] {
    const seedNames = [
      '우리동네식당',
      '맛있는집',
      '한끼하우스',
      '오늘의식탁',
      '빠른한끼',
      '든든식당',
      '배부른주방',
      '근처맛집',
      '골목식당',
      '행복밥상',
    ]

    const categoryLabel: Record<string, string> = {
      korean: '한식',
      chinese: '중식',
      japanese: '일식',
      western: '양식',
      fastfood: '패스트푸드',
      snack: '분식',
      all: '종합',
    }

    const list = seedNames.map((name, i) => {
      const distanceM = Math.floor(100 + Math.random() * Math.max(radiusM - 80, 120))
      const offset = (Math.random() - 0.5) * 0.01

      return {
        id: `nearby-${i + 1}`,
        name: `${name} ${i + 1}호점`,
        category: categoryLabel[category ?? 'all'] ?? '종합',
        distanceM,
        isOpenNow: Math.random() > 0.2,
        lat: Number((lat + offset).toFixed(7)),
        lng: Number((lng + offset).toFixed(7)),
      }
    })

    return list
      .filter((item) => item.distanceM <= radiusM)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 8)
  }

  buildAnalysisRecommendations(
    topCategory: string | null,
    recentMenuIds: string[],
    periodDays: number,
    totalSelections: number,
  ): AnalysisRecommendationResult {
    const recentSet = new Set(recentMenuIds)

    // 이력이 부족한 경우: 인기(샘플 상단) + 아직 고르지 않은 메뉴 위주 fallback
    if (totalSelections < 5 || !topCategory) {
      const fallback = SAMPLE_MENUS
        .filter((m) => !recentSet.has(m.id))
        .slice(0, 5)
        .map((m) => ({
          id: m.id,
          name: m.name,
          category: m.category,
          priceRange: `${m.priceMin.toLocaleString()}~${m.priceMax.toLocaleString()}원`,
          tags: m.tags,
          reason: '기록이 아직 적어서, 처음 쓰기 좋은 대표 메뉴를 추천했어요.',
        }))

      return {
        recommendations: fallback,
        summary: {
          message: `최근 ${periodDays}일 기록이 ${totalSelections}건이라 기본 추천 모드로 제공해요.`,
          topCategory: null,
          recentPickCount: totalSelections,
        },
      }
    }

    // 이력이 충분한 경우: 최다 카테고리 기반 + 최근 반복 메뉴는 제외
    const categoryBased = SAMPLE_MENUS
      .filter((m) => m.category === topCategory)
      .filter((m) => !recentSet.has(m.id))
      .slice(0, 5)
      .map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        priceRange: `${m.priceMin.toLocaleString()}~${m.priceMax.toLocaleString()}원`,
        tags: m.tags,
        reason: `최근 가장 자주 고른 ${topCategory} 카테고리 기반 추천이에요.`,
      }))

    return {
      recommendations: categoryBased,
      summary: {
        message: `최근 ${periodDays}일 기록을 분석해 개인화 추천을 만들었어요.`,
        topCategory,
        recentPickCount: totalSelections,
      },
    }
  }

  // ─── 하드 필터: 조건 불일치 메뉴 제거 ────────────────────
  private hardFilter(menus: Menu[], answers: QuestionAnswerDto): Menu[] {
    return menus.filter((menu) => {
      // 예산 필터
      if (answers.budget) {
        const { min, max } = this.budgetRange(answers.budget)
        // 메뉴 최소가격이 예산 최대를 초과하면 제외
        if (menu.priceMin > max) return false
      }

      // 매운맛 필터 (싫어하는 단계보다 강하면 제외)
      if (answers.spicy === 'none' && menu.spicyLevel > 0) return false
      if (answers.spicy === 'little' && menu.spicyLevel > 1) return false
      if (answers.spicy === 'medium' && menu.spicyLevel > 2) return false

      // 카테고리 필터
      if (answers.category && answers.category !== 'any') {
        if (menu.category !== answers.category) return false
      }

      return true
    })
  }

  // ─── 점수 계산: 얼마나 잘 맞는지 ──────────────────────────
  private scoreMenu(menu: Menu, answers: QuestionAnswerDto): RecommendedMenu {
    let score = 10  // 기본 점수
    const reasons: string[] = []
    const avgPrice = (menu.priceMin + menu.priceMax) / 2

    // 예산 점수: 예산 범위 적합도 + 중앙값 근접도
    if (answers.budget) {
      const { min, max } = this.budgetRange(answers.budget)
      const target = this.budgetTarget(answers.budget)

      if (menu.priceMin <= max && menu.priceMax >= min) {
        score += 4
        reasons.push(`예산(${max.toLocaleString()}원) 내 선택 가능`)
      } else {
        score -= 4
        reasons.push('예산 범위와 다소 차이 있음')
      }

      const budgetDistance = Math.abs(avgPrice - target)
      if (budgetDistance <= 2000) {
        score += 3
      } else if (budgetDistance <= 5000) {
        score += 1
      } else if (budgetDistance > 10000) {
        score -= 2
      }

      // 절약 성향(cheap)일 때는 더 저렴한 메뉴를 우선 배치
      if (answers.budget === 'cheap') {
        if (menu.priceMax <= 9000) {
          score += 4
          reasons.push('절약 우선: 가성비 메뉴')
        } else if (menu.priceMax <= 10000) {
          score += 2
          reasons.push('절약 우선: 저예산 메뉴')
        }
      }

      // 중간 예산은 가급적 예산 중앙대(12,000~17,000원)를 선호
      if (answers.budget === 'mid' && menu.priceMin >= 12000 && menu.priceMax <= 17000) {
        score += 2
      }

      // 높은 예산은 너무 저렴한 메뉴를 살짝 감점해 다양성 확보
      if (answers.budget === 'high' && menu.priceMax < 15000) {
        score -= 1
      }
    }

    // 매운맛 점수: 단계 차이 기반
    if (answers.spicy) {
      const preferred = this.spicyNumber(answers.spicy)
      const diff = Math.abs(menu.spicyLevel - preferred)

      if (diff === 0) {
        score += 4
        const spicyLabel = ['안매운', '약간 매운', '보통 매운', '매운'][preferred]
        reasons.push(`${spicyLabel} 메뉴`)
      } else if (diff === 1) {
        score += 1
      } else {
        score -= 2
      }
    }

    // 국물 보너스
    const hasBrothTag = menu.tags.includes('국물')
    if (answers.broth === 'yes' && hasBrothTag) {
      score += 4
      reasons.push('국물 있는 메뉴')
    } else if (answers.broth === 'yes' && !hasBrothTag) {
      score -= 2
    }
    if (answers.broth === 'no' && !hasBrothTag) {
      score += 3
    } else if (answers.broth === 'no' && hasBrothTag) {
      score -= 1
    }

    // 혼밥/모임 보너스 + 약한 감점
    if (answers.diningStyle === 'solo' && menu.tags.includes('혼밥')) {
      score += 3
      reasons.push('혼밥에 적합')
    } else if (answers.diningStyle === 'solo' && !menu.tags.includes('혼밥')) {
      score -= 1
    }
    if (answers.diningStyle === 'group' && menu.tags.includes('모임')) {
      score += 3
      reasons.push('모임에 적합')
    } else if (answers.diningStyle === 'group' && !menu.tags.includes('모임')) {
      score -= 1
    }

    // 카테고리 선호 점수
    if (answers.category && answers.category !== 'any') {
      if (menu.category === answers.category) {
        score += 4
        reasons.push('선호 카테고리 일치')
      } else {
        score -= 2
      }
    }

    // 이유가 하나도 없으면 기본 이유 추가
    if (reasons.length === 0) {
      reasons.push('현재 조건에 잘 맞는 메뉴')
    }

    return {
      id: menu.id,
      name: menu.name,
      category: menu.category,
      priceMin: menu.priceMin,
      priceMax: menu.priceMax,
      tags: menu.tags,
      score,
      reasons,
    }
  }

  // ─── 헬퍼: 예산 → 가격 범위 변환 ─────────────────────────
  private budgetRange(budget: BudgetLevel): { min: number; max: number } {
    if (budget === 'cheap') return { min: 0, max: 10000 }
    if (budget === 'mid')   return { min: 10000, max: 20000 }
    return { min: 20000, max: 999999 }
  }

  private budgetTarget(budget: BudgetLevel): number {
    if (budget === 'cheap') return 8000
    if (budget === 'mid') return 15000
    return 28000
  }

  // ─── 헬퍼: 매운맛 문자 → 숫자 변환 ───────────────────────
  private spicyNumber(spicy: SpicyPreference): number {
    return { none: 0, little: 1, medium: 2, hot: 3 }[spicy]
  }

  private compareByTieBreaker(a: RecommendedMenu, b: RecommendedMenu, answers: QuestionAnswerDto): number {
    // 1) 예산이 중요할 때는 평균가격이 더 낮은 메뉴 우선
    if (answers.budget === 'cheap') {
      const aAvg = (a.priceMin + a.priceMax) / 2
      const bAvg = (b.priceMin + b.priceMax) / 2
      if (aAvg !== bAvg) return aAvg - bAvg
    }

    // 2) 매운맛이 지정된 경우 선호 단계에 더 가까운 메뉴 우선
    if (answers.spicy) {
      const preferred = this.spicyNumber(answers.spicy)
      const aDiff = Math.abs(this.extractSpicyLevel(a) - preferred)
      const bDiff = Math.abs(this.extractSpicyLevel(b) - preferred)
      if (aDiff !== bDiff) return aDiff - bDiff
    }

    // 3) 마지막 동일점수면 이름 오름차순으로 안정화
    return a.name.localeCompare(b.name)
  }

  private extractSpicyLevel(menu: RecommendedMenu): number {
    const found = SAMPLE_MENUS.find((m) => m.id === menu.id)
    return found?.spicyLevel ?? 0
  }

  // ─── 개인화 점수 계산 (고도화) ────────────────────────────
  private scoreMenuPersonalized(
    menu: Menu,
    settings: UserSettings,
    patterns: any,
  ): RecommendedMenu & { reasoning: string } {
    let score = 10
    const reasons: string[] = []

    // 사용자 매운맛 레벨에 맞는지
    if (menu.spicyLevel <= settings.maxSpicyLevel) {
      const match = Math.abs(menu.spicyLevel - patterns.avgSpicyLevel)
      score += Math.max(0, 5 - match)

      if (match < 1) {
        reasons.push('당신의 매운맛 선호도와 정확히 일치')
      }
    } else {
      // 설정 범위 초과하면 감점
      score -= 5
    }

    // 선호 카테고리 보너스
    if (settings.preferredCategories.includes(menu.category)) {
      score += 6
      reasons.push(`${menu.category} - 좋아하는 카테고리`)
    } else {
      score -= 2
    }

    // 가격대 선호 반영
    const avgPrice = (menu.priceMin + menu.priceMax) / 2
    const priceDiff = Math.abs(avgPrice - patterns.avgPrice)

    if (priceDiff < 3000) {
      score += 3
      reasons.push('최근 선호 가격대와 일치')
    } else if (priceDiff > 10000) {
      score -= 2
    }

    // 타그 보너스 (혼밥, 모임 등)
    if (menu.tags.includes('건강')) score += 2
    if (menu.tags.includes('빠른')) score += 1

    if (reasons.length === 0) {
      reasons.push('당신의 취향에 맞는 추천 메뉴')
    }

    return {
      id: menu.id,
      name: menu.name,
      category: menu.category,
      priceMin: menu.priceMin,
      priceMax: menu.priceMax,
      tags: menu.tags,
      score,
      reasons,
      reasoning: reasons.join(' | '),
    }
  }

  // ─── 설정 설명 문구 생성 ───────────────────────────────────
  private describeSettings(settings: UserSettings): string[] {
    const applied: string[] = []

    const spicyLabels = ['안매운', '약간 매운', '중간 매운', '매우 매운']
    applied.push(`매운맛 ≤ ${spicyLabels[settings.maxSpicyLevel]}`)

    if (settings.preferredCategories.length > 0) {
      applied.push(`선호 카테고리: ${settings.preferredCategories.join(', ')}`)
    }

    return applied
  }
}
