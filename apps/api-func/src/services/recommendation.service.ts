import { SAMPLE_MENUS, Menu } from './seed-data'

export type BudgetLevel = 'cheap' | 'mid' | 'high'
export type SpicyPreference = 'none' | 'little' | 'medium' | 'hot'
export type BrothPreference = 'yes' | 'no' | 'any'
export type DiningStyle = 'solo' | 'group' | 'any'
export type CategoryPreference = 'korean' | 'chinese' | 'japanese' | 'western' | 'fastfood' | 'snack' | 'any'
export type RouletteCategory = 'korean' | 'chinese' | 'japanese' | 'western' | 'fastfood' | 'snack' | 'all'

export interface QuestionAnswerDto {
  budget?: BudgetLevel
  spicy?: SpicyPreference
  broth?: BrothPreference
  diningStyle?: DiningStyle
  category?: CategoryPreference
}

export interface RouletteRequestDto {
  category?: RouletteCategory
  excludeMenuIds?: string[]
  lat?: number
  lng?: number
  radiusM?: number
  useNearby?: boolean
}

export interface NearbyRestaurantItem {
  id: string
  name: string
  category: string
  distanceM: number
  isOpenNow: boolean
  lat: number
  lng: number
}

export interface RecommendedMenu {
  id: string
  name: string
  category: string
  priceMin: number
  priceMax: number
  tags: string[]
  score: number
  reasons: string[]
}

export class RecommendationService {
  recommend(answers: QuestionAnswerDto): RecommendedMenu[] {
    const filtered = this.hardFilter(SAMPLE_MENUS, answers)
    const scored = filtered.map((menu) => this.scoreMenu(menu, answers))
    return scored
      .sort((a, b) => {
        const diff = b.score - a.score
        if (diff !== 0) return diff
        return this.compareByTieBreaker(a, b, answers)
      })
      .slice(0, 3)
  }

  spinRoulette(input: RouletteRequestDto) {
    const category = input.category ?? 'all'
    const excludeIds = new Set(input.excludeMenuIds ?? [])

    const baseMenus = SAMPLE_MENUS.filter((m) => {
      if (excludeIds.has(m.id)) return false
      if (category !== 'all' && m.category !== category) return false
      return true
    })

    if (baseMenus.length === 0) throw new Error('조건에 맞는 룰렛 후보 메뉴가 없습니다.')

    const nearbyEnabled =
      input.useNearby === true &&
      typeof input.lat === 'number' &&
      typeof input.lng === 'number'

    const nearbyRestaurants = nearbyEnabled
      ? this.getNearbyRestaurants(input.lat!, input.lng!, input.radiusM ?? 1000, category)
      : []

    const candidates = baseMenus.map((menu, index) => ({
      menu,
      nearby: nearbyRestaurants.length > 0
        ? nearbyRestaurants[index % Math.max(nearbyRestaurants.length, 1)]
        : null,
    }))

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

  getNearbyRestaurants(lat: number, lng: number, radiusM = 1000, category: RouletteCategory = 'all'): NearbyRestaurantItem[] {
    const seedNames = ['우리동네식당', '맛있는집', '한끼하우스', '오늘의식탁', '빠른한끼', '든든식당', '배부른주방', '근처맛집', '골목식당', '행복밥상']
    const categoryLabel: Record<string, string> = { korean: '한식', chinese: '중식', japanese: '일식', western: '양식', fastfood: '패스트푸드', snack: '분식', all: '종합' }

    return seedNames
      .map((name, i) => {
        const distanceM = Math.floor(100 + Math.random() * Math.max(radiusM - 80, 120))
        const offset = (Math.random() - 0.5) * 0.01
        return {
          id: `nearby-${i + 1}`,
          name: `${name} ${i + 1}호점`,
          category: categoryLabel[category] ?? '종합',
          distanceM,
          isOpenNow: Math.random() > 0.2,
          lat: Number((lat + offset).toFixed(7)),
          lng: Number((lng + offset).toFixed(7)),
        }
      })
      .filter((item) => item.distanceM <= radiusM)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 8)
  }

  buildAnalysisRecommendations(topCategory: string | null, recentMenuIds: string[], periodDays: number, totalSelections: number) {
    const recentSet = new Set(recentMenuIds)

    if (totalSelections < 5 || !topCategory) {
      const fallback = SAMPLE_MENUS
        .filter((m) => !recentSet.has(m.id))
        .slice(0, 5)
        .map((m) => ({
          id: m.id, name: m.name, category: m.category,
          priceRange: `${m.priceMin.toLocaleString()}~${m.priceMax.toLocaleString()}원`,
          tags: m.tags,
          reason: '기록이 아직 적어서, 처음 쓰기 좋은 대표 메뉴를 추천했어요.',
        }))
      return {
        recommendations: fallback,
        summary: { message: `최근 ${periodDays}일 기록이 ${totalSelections}건이라 기본 추천 모드로 제공해요.`, topCategory: null, recentPickCount: totalSelections },
      }
    }

    const categoryBased = SAMPLE_MENUS
      .filter((m) => m.category === topCategory && !recentSet.has(m.id))
      .slice(0, 5)
      .map((m) => ({
        id: m.id, name: m.name, category: m.category,
        priceRange: `${m.priceMin.toLocaleString()}~${m.priceMax.toLocaleString()}원`,
        tags: m.tags,
        reason: `최근 가장 자주 고른 ${topCategory} 카테고리 기반 추천이에요.`,
      }))
    return {
      recommendations: categoryBased,
      summary: { message: `최근 ${periodDays}일 기록을 분석해 개인화 추천을 만들었어요.`, topCategory, recentPickCount: totalSelections },
    }
  }

  private hardFilter(menus: Menu[], answers: QuestionAnswerDto): Menu[] {
    return menus.filter((menu) => {
      if (answers.budget) {
        const { max } = this.budgetRange(answers.budget)
        if (menu.priceMin > max) return false
      }
      if (answers.spicy === 'none' && menu.spicyLevel > 0) return false
      if (answers.spicy === 'little' && menu.spicyLevel > 1) return false
      if (answers.spicy === 'medium' && menu.spicyLevel > 2) return false
      if (answers.category && answers.category !== 'any' && menu.category !== answers.category) return false
      return true
    })
  }

  private scoreMenu(menu: Menu, answers: QuestionAnswerDto): RecommendedMenu {
    let score = 10
    const reasons: string[] = []
    const avgPrice = (menu.priceMin + menu.priceMax) / 2

    if (answers.budget) {
      const { min, max } = this.budgetRange(answers.budget)
      const target = this.budgetTarget(answers.budget)

      if (menu.priceMin <= max && menu.priceMax >= min) {
        score += 4
        reasons.push(`예산(${max.toLocaleString()}원) 내 선택 가능`)
      } else {
        score -= 4
      }

      const budgetDist = Math.abs(avgPrice - target)
      if (budgetDist <= 2000) score += 3
      else if (budgetDist <= 5000) score += 1
      else if (budgetDist > 10000) score -= 2

      if (answers.budget === 'cheap') {
        if (menu.priceMax <= 9000) { score += 4; reasons.push('절약 우선: 가성비 메뉴') }
        else if (menu.priceMax <= 10000) { score += 2; reasons.push('절약 우선: 저예산 메뉴') }
      }
      if (answers.budget === 'mid' && menu.priceMin >= 12000 && menu.priceMax <= 17000) score += 2
      if (answers.budget === 'high' && menu.priceMax < 15000) score -= 1
    }

    if (answers.spicy) {
      const preferred = this.spicyNumber(answers.spicy)
      const diff = Math.abs(menu.spicyLevel - preferred)
      if (diff === 0) {
        score += 4
        const label = ['안매운', '약간 매운', '보통 매운', '매운'][preferred]
        reasons.push(`${label} 메뉴`)
      } else if (diff === 1) score += 1
      else score -= 2
    }

    const hasBroth = menu.tags.includes('국물')
    if (answers.broth === 'yes' && hasBroth) { score += 4; reasons.push('국물 있는 메뉴') }
    else if (answers.broth === 'yes' && !hasBroth) score -= 2
    if (answers.broth === 'no' && !hasBroth) score += 3
    else if (answers.broth === 'no' && hasBroth) score -= 1

    if (answers.diningStyle === 'solo' && menu.tags.includes('혼밥')) { score += 3; reasons.push('혼밥에 적합') }
    else if (answers.diningStyle === 'solo' && !menu.tags.includes('혼밥')) score -= 1

    if (answers.diningStyle === 'group' && menu.tags.includes('모임')) { score += 3; reasons.push('모임에 적합') }
    else if (answers.diningStyle === 'group' && !menu.tags.includes('모임')) score -= 1

    if (answers.category && answers.category !== 'any') {
      if (menu.category === answers.category) { score += 4; reasons.push('선호 카테고리 일치') }
      else score -= 2
    }

    if (reasons.length === 0) reasons.push('현재 조건에 잘 맞는 메뉴')

    return { id: menu.id, name: menu.name, category: menu.category, priceMin: menu.priceMin, priceMax: menu.priceMax, tags: menu.tags, score, reasons }
  }

  private budgetRange(budget: BudgetLevel) {
    if (budget === 'cheap') return { min: 0, max: 10000 }
    if (budget === 'mid') return { min: 10000, max: 20000 }
    return { min: 20000, max: 999999 }
  }

  private budgetTarget(budget: BudgetLevel) {
    if (budget === 'cheap') return 8000
    if (budget === 'mid') return 15000
    return 28000
  }

  private spicyNumber(spicy: SpicyPreference) {
    return { none: 0, little: 1, medium: 2, hot: 3 }[spicy]
  }

  private compareByTieBreaker(a: RecommendedMenu, b: RecommendedMenu, answers: QuestionAnswerDto) {
    if (answers.budget === 'cheap') {
      const aAvg = (a.priceMin + a.priceMax) / 2
      const bAvg = (b.priceMin + b.priceMax) / 2
      if (aAvg !== bAvg) return aAvg - bAvg
    }
    if (answers.spicy) {
      const preferred = this.spicyNumber(answers.spicy)
      const aDiff = Math.abs((SAMPLE_MENUS.find((m) => m.id === a.id)?.spicyLevel ?? 0) - preferred)
      const bDiff = Math.abs((SAMPLE_MENUS.find((m) => m.id === b.id)?.spicyLevel ?? 0) - preferred)
      if (aDiff !== bDiff) return aDiff - bDiff
    }
    return a.name.localeCompare(b.name)
  }
}
