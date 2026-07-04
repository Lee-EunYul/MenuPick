import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { recommendationService, selectionsService } from '../services'

export async function recommendAnalysis(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const userId = request.query.get('userId')
    const periodDaysStr = request.query.get('periodDays')

    if (!userId || userId.trim().length === 0) {
      return jsonResponse(400, { error: 'userId는 필수입니다.' })
    }

    const periodDays = periodDaysStr ? Number(periodDaysStr) : 30
    if (!Number.isFinite(periodDays) || periodDays <= 0 || periodDays > 365) {
      return jsonResponse(400, { error: 'periodDays는 1~365 사이 숫자여야 합니다.' })
    }

    const stats = selectionsService.getStats(userId, periodDays)
    const history = selectionsService.getHistory(userId)
    const recentIds = history.slice(0, 10).map((h) => h.menuId)
    const analysis = recommendationService.buildAnalysisRecommendations(stats.topCategory, recentIds, periodDays, stats.totalSelections)

    return jsonResponse(200, {
      data: { stats, summary: analysis.summary, recommendations: analysis.recommendations },
      meta: { message: '이력 분석 기반 추천 결과입니다.', userId, periodDays },
    })
  } catch (err) {
    context.error('recommend-analysis error:', err)
    return jsonResponse(500, { error: '이력 분석 추천 중 서버 오류가 발생했습니다.' })
  }
}

app.http('recommendAnalysis', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'v1/recommend/analysis',
  handler: recommendAnalysis,
})

function jsonResponse(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}
