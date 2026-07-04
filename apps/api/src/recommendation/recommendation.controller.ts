/**
 * recommendation.controller.ts
 *
 * API 요청을 받아서 서비스에 넘기고 결과를 돌려주는 문지기 역할
 * "컨트롤러" = 주문을 받아 주방(서비스)에 전달하는 홀 직원
 */

import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Get,
  Query,
  InternalServerErrorException,
} from '@nestjs/common'
import { randomUUID } from 'crypto'
import { RecommendationService } from './recommendation.service'
import {
  CategoryPreference,
  QuestionAnswerDto,
  BudgetLevel,
  BrothPreference,
  DiningStyle,
  SpicyPreference,
} from './dto/question-answer.dto'
import { RouletteRequestDto } from './dto/roulette-request.dto'
import { SelectionsService } from '../selections/selections.service'

type RouletteCategoryValue = Exclude<RouletteRequestDto['category'], undefined>

@Controller('recommend')
export class RecommendationController {
  private readonly validBudget = new Set<BudgetLevel>(['cheap', 'mid', 'high'])
  private readonly validSpicy = new Set<SpicyPreference>(['none', 'little', 'medium', 'hot'])
  private readonly validBroth = new Set<BrothPreference>(['yes', 'no', 'any'])
  private readonly validDiningStyle = new Set<DiningStyle>(['solo', 'group', 'any'])
  private readonly validQuestionCategory = new Set<CategoryPreference>([
    'korean',
    'chinese',
    'japanese',
    'western',
    'fastfood',
    'snack',
    'any',
  ])
  private readonly validRouletteCategory = new Set<RouletteCategoryValue>([
    'korean',
    'chinese',
    'japanese',
    'western',
    'fastfood',
    'snack',
    'all',
  ])

  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly selectionsService: SelectionsService,
  ) {}

  /**
   * POST /api/v1/recommend/question
   *
   * 요청 예시:
   * {
   *   "budget": "cheap",
   *   "spicy": "none",
   *   "broth": "yes",
   *   "diningStyle": "solo",
   *   "category": "any"
   * }
   */
  @Post('question')
  getRecommendation(@Body() answers: QuestionAnswerDto) {
    try {
      const normalized = this.normalizeQuestionAnswers(answers)
      const results = this.recommendationService.recommend(normalized)

      // 추천 결과가 없는 경우 (조건이 너무 까다로울 때)
      if (results.length === 0) {
        return {
          data: [],
          meta: this.buildMeta('조건에 맞는 메뉴가 없어요. 조건을 조금 넓혀보세요.', {
            totalCandidates: 0,
            appliedFilters: normalized,
          }),
        }
      }

      return {
        data: results.map((menu) => ({
          id: menu.id,
          name: menu.name,
          category: menu.category,
          priceRange: `${menu.priceMin.toLocaleString()}~${menu.priceMax.toLocaleString()}원`,
          tags: menu.tags,
          reasons: menu.reasons,
        })),
        meta: this.buildMeta(`${results.length}개 메뉴를 추천해드려요!`, {
          totalCandidates: results.length,
          appliedFilters: normalized,
        }),
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error
      }

      throw new InternalServerErrorException('추천 계산 중 서버 오류가 발생했습니다.')
    }
  }

  /**
   * POST /api/v1/recommend/roulette
   */
  @Post('roulette')
  spinRoulette(@Body() body: RouletteRequestDto) {
    try {
      const normalized = this.normalizeRouletteRequest(body)
      const result = this.recommendationService.spinRoulette(normalized)

      return {
        data: result,
        meta: this.buildMeta('룰렛 결과가 확정되었습니다.', {
          totalCandidates: result.candidates.length,
          nearbyMode: normalized.useNearby === true,
        }),
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error
      }

      throw new BadRequestException(
        error instanceof Error ? error.message : '룰렛 실행 중 오류가 발생했습니다.',
      )
    }
  }

  /**
   * GET /api/v1/recommend/restaurants/nearby
   */
  @Get('restaurants/nearby')
  getNearbyRestaurants(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusM') radiusM?: string,
    @Query('category') category?: RouletteRequestDto['category'],
  ) {
    try {
      if (!lat || !lng) {
        throw new BadRequestException('lat, lng는 필수입니다.')
      }

      const parsedLat = Number(lat)
      const parsedLng = Number(lng)
      const parsedRadius = radiusM ? Number(radiusM) : 1000
      const normalizedCategory = this.normalizeRouletteCategory(category ?? 'all', 'category')

      if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
        throw new BadRequestException('lat, lng는 숫자여야 합니다.')
      }

      if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
        throw new BadRequestException('lat/lng 좌표 범위가 올바르지 않습니다.')
      }

      if (!Number.isFinite(parsedRadius) || parsedRadius <= 0 || parsedRadius > 10000) {
        throw new BadRequestException('radiusM는 1~10000 사이 숫자여야 합니다.')
      }

      const restaurants = this.recommendationService.getNearbyRestaurants(
        parsedLat,
        parsedLng,
        parsedRadius,
        normalizedCategory,
      )

      return {
        data: restaurants,
        meta: this.buildMeta('근처 음식점 목록을 조회했어요.', {
          total: restaurants.length,
          radiusM: parsedRadius,
          category: normalizedCategory,
        }),
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error
      }

      throw new InternalServerErrorException('근처 음식점 조회 중 서버 오류가 발생했습니다.')
    }
  }

  /**
   * GET /api/v1/recommend/analysis?userId=user-001&periodDays=30
   */
  @Get('analysis')
  getAnalysisRecommendation(
    @Query('userId') userId?: string,
    @Query('periodDays') periodDays?: string,
  ) {
    try {
      if (!userId || userId.trim().length === 0) {
        throw new BadRequestException('userId는 필수입니다.')
      }

      const parsedPeriod = periodDays ? Number(periodDays) : 30
      if (!Number.isFinite(parsedPeriod) || parsedPeriod <= 0 || parsedPeriod > 365) {
        throw new BadRequestException('periodDays는 1~365 사이 숫자여야 합니다.')
      }

      const stats = this.selectionsService.getStats(userId, parsedPeriod)
      const history = this.selectionsService.getHistory(userId)

      const recentIds = history.slice(0, 10).map((h) => h.menuId)
      const analysis = this.recommendationService.buildAnalysisRecommendations(
        stats.topCategory,
        recentIds,
        parsedPeriod,
        stats.totalSelections,
      )

      return {
        data: {
          stats,
          summary: analysis.summary,
          recommendations: analysis.recommendations,
        },
        meta: this.buildMeta('이력 분석 기반 추천 결과입니다.', {
          userId,
          periodDays: parsedPeriod,
        }),
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error
      }

      throw new InternalServerErrorException('이력 분석 추천 중 서버 오류가 발생했습니다.')
    }
  }

  /**
   * POST /api/v1/recommend/personalized
   * 
   * 요청 예시:
   * {
   *   "userId": "user-001",
   *   "settings": {
   *     "userId": "user-001",
   *     "maxSpicyLevel": 2,
   *     "preferredCategories": ["한식", "양식"]
   *   },
   *   "periodDays": 30,
   *   "count": 5
   * }
   */
  @Post('personalized')
  getPersonalizedRecommendation(
    @Body() body: {
      userId: string
      settings: {
        userId: string
        maxSpicyLevel: number
        preferredCategories: string[]
      }
      periodDays?: number
      count?: number
    },
  ) {
    try {
      if (!body.userId || !body.settings) {
        throw new BadRequestException('userId와 settings는 필수입니다.')
      }

      if (!Number.isInteger(body.settings.maxSpicyLevel) || body.settings.maxSpicyLevel < 0 || body.settings.maxSpicyLevel > 3) {
        throw new BadRequestException('settings.maxSpicyLevel은 0~3 정수여야 합니다.')
      }

      if (!Array.isArray(body.settings.preferredCategories)) {
        throw new BadRequestException('settings.preferredCategories는 배열이어야 합니다.')
      }

      const periodDays = body.periodDays ?? 30
      const count = body.count ?? 5

      if (!Number.isFinite(periodDays) || periodDays <= 0 || periodDays > 365) {
        throw new BadRequestException('periodDays는 1~365 사이 숫자여야 합니다.')
      }

      if (!Number.isFinite(count) || count <= 0 || count > 20) {
        throw new BadRequestException('count는 1~20 사이 숫자여야 합니다.')
      }

      const result = this.recommendationService.getPersonalizedRecommendations(
        body.userId,
        body.settings,
        periodDays,
        count,
      )

      return {
        data: result,
        meta: this.buildMeta('개인화 추천이 완성되었습니다! 설정과 선택 패턴을 반영했어요.', {
          userId: body.userId,
          periodDays,
          count,
        }),
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error
      }

      throw new InternalServerErrorException('개인화 추천 처리 중 서버 오류가 발생했습니다.')
    }
  }

  private normalizeQuestionAnswers(raw: QuestionAnswerDto | undefined): Required<QuestionAnswerDto> {
    const source = raw ?? {}

    const budget = this.normalizeEnum(source.budget, this.validBudget, 'budget', 'cheap')
    const spicy = this.normalizeEnum(source.spicy, this.validSpicy, 'spicy', 'little')
    const broth = this.normalizeEnum(source.broth, this.validBroth, 'broth', 'any')
    const diningStyle = this.normalizeEnum(source.diningStyle, this.validDiningStyle, 'diningStyle', 'solo')
    const category = this.normalizeQuestionCategory(source.category ?? 'any', 'category')

    return { budget, spicy, broth, diningStyle, category }
  }

  private normalizeRouletteRequest(raw: RouletteRequestDto | undefined): RouletteRequestDto {
    const source = raw ?? {}
    const category = this.normalizeRouletteCategory(source.category ?? 'all', 'category')
    const useNearby = source.useNearby === true
    const radiusMRaw = source.radiusM ?? 1000
    const radiusM = Math.min(3000, Math.max(100, Number(radiusMRaw)))

    if (!Number.isFinite(radiusM)) {
      throw new BadRequestException('radiusM는 숫자여야 합니다.')
    }

    const normalizedExcludeMenuIds = Array.isArray(source.excludeMenuIds)
      ? source.excludeMenuIds
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .slice(0, 100)
      : []

    if (!useNearby) {
      return {
        category,
        useNearby: false,
        radiusM,
        excludeMenuIds: normalizedExcludeMenuIds,
      }
    }

    if (typeof source.lat !== 'number' || typeof source.lng !== 'number') {
      throw new BadRequestException('위치 기반 추천(useNearby=true)에는 lat/lng가 필요합니다.')
    }

    if (source.lat < -90 || source.lat > 90 || source.lng < -180 || source.lng > 180) {
      throw new BadRequestException('lat/lng 좌표 범위가 올바르지 않습니다.')
    }

    return {
      category,
      useNearby: true,
      lat: source.lat,
      lng: source.lng,
      radiusM,
      excludeMenuIds: normalizedExcludeMenuIds,
    }
  }

  private normalizeQuestionCategory(value: unknown, fieldName: string): CategoryPreference {
    return this.normalizeEnum(value, this.validQuestionCategory, fieldName, 'any')
  }

  private normalizeRouletteCategory(value: unknown, fieldName: string): RouletteCategoryValue {
    return this.normalizeEnum(value, this.validRouletteCategory, fieldName, 'all')
  }

  private normalizeEnum<T extends string>(
    value: unknown,
    allowed: Set<T>,
    fieldName: string,
    fallback: T,
  ): T {
    if (value === undefined || value === null) {
      return fallback
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName}는 문자열이어야 합니다.`)
    }

    if (!allowed.has(value as T)) {
      throw new BadRequestException(`${fieldName} 값이 올바르지 않습니다.`)
    }

    return value as T
  }

  private buildMeta(message: string, extra: Record<string, unknown> = {}) {
    return {
      message,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
      ...extra,
    }
  }
}
