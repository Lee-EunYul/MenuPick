import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { recommendationService } from '../services'
import { QuestionAnswerDto, BudgetLevel, SpicyPreference, BrothPreference, DiningStyle, CategoryPreference } from '../services/recommendation.service'

const VALID_BUDGET = new Set<BudgetLevel>(['cheap', 'mid', 'high'])
const VALID_SPICY = new Set<SpicyPreference>(['none', 'little', 'medium', 'hot'])
const VALID_BROTH = new Set<BrothPreference>(['yes', 'no', 'any'])
const VALID_DINING = new Set<DiningStyle>(['solo', 'group', 'any'])
const VALID_CATEGORY = new Set<CategoryPreference>(['korean', 'chinese', 'japanese', 'western', 'fastfood', 'snack', 'any'])

export async function recommendQuestion(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as Record<string, unknown>

    const answers: QuestionAnswerDto = {}
    if (body.budget && VALID_BUDGET.has(body.budget as BudgetLevel)) answers.budget = body.budget as BudgetLevel
    if (body.spicy && VALID_SPICY.has(body.spicy as SpicyPreference)) answers.spicy = body.spicy as SpicyPreference
    if (body.broth && VALID_BROTH.has(body.broth as BrothPreference)) answers.broth = body.broth as BrothPreference
    if (body.diningStyle && VALID_DINING.has(body.diningStyle as DiningStyle)) answers.diningStyle = body.diningStyle as DiningStyle
    if (body.category && VALID_CATEGORY.has(body.category as CategoryPreference)) answers.category = body.category as CategoryPreference

    const results = recommendationService.recommend(answers)

    if (results.length === 0) {
      return jsonResponse(200, {
        data: [],
        meta: { message: '조건에 맞는 메뉴가 없어요. 조건을 조금 넓혀보세요.', totalCandidates: 0 },
      })
    }

    return jsonResponse(200, {
      data: results.map((menu) => ({
        id: menu.id,
        name: menu.name,
        category: menu.category,
        priceRange: `${menu.priceMin.toLocaleString()}~${menu.priceMax.toLocaleString()}원`,
        tags: menu.tags,
        reasons: menu.reasons,
      })),
      meta: { message: `${results.length}개 메뉴를 추천해드려요!`, totalCandidates: results.length },
    })
  } catch (err) {
    context.error('recommend-question error:', err)
    return jsonResponse(500, { error: '추천 계산 중 서버 오류가 발생했습니다.' })
  }
}

app.http('recommendQuestion', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'v1/recommend/question',
  handler: recommendQuestion,
})

function jsonResponse(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}
