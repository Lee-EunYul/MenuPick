import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { selectionsService } from '../services'
import { CreateSelectionDto, SelectionSource } from '../services/selections.service'

const VALID_SOURCE = new Set<SelectionSource>(['question', 'roulette', 'ai_analysis'])

export async function selectionsSave(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as Record<string, unknown>

    if (!body.userId || typeof body.userId !== 'string') return jsonResponse(400, { error: 'userId는 필수입니다.' })
    if (!body.menuId || typeof body.menuId !== 'string') return jsonResponse(400, { error: 'menuId는 필수입니다.' })
    if (!body.source || !VALID_SOURCE.has(body.source as SelectionSource)) return jsonResponse(400, { error: 'source는 question | roulette | ai_analysis 중 하나여야 합니다.' })
    if (!selectionsService.hasMenu(body.menuId as string)) return jsonResponse(400, { error: '존재하지 않는 menuId 입니다.' })

    const input: CreateSelectionDto = {
      userId: body.userId as string,
      menuId: body.menuId as string,
      source: body.source as SelectionSource,
      accepted: typeof body.accepted === 'boolean' ? body.accepted : true,
    }

    const data = selectionsService.saveSelection(input)

    return jsonResponse(200, { data, meta: { message: '선택 기록이 저장되었습니다.' } })
  } catch (err) {
    context.error('selections-save error:', err)
    return jsonResponse(500, { error: '선택 저장 중 오류가 발생했습니다.' })
  }
}

export async function selectionsHistory(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const userId = request.query.get('userId')
    if (!userId) return jsonResponse(400, { error: 'userId는 필수입니다.' })

    const from = request.query.get('from') ?? undefined
    const to = request.query.get('to') ?? undefined
    const data = selectionsService.getHistory(userId, from, to)

    return jsonResponse(200, { data, meta: { total: data.length } })
  } catch (err) {
    context.error('selections-history error:', err)
    return jsonResponse(500, { error: '이력 조회 중 오류가 발생했습니다.' })
  }
}

export async function selectionsStats(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const userId = request.query.get('userId')
    if (!userId) return jsonResponse(400, { error: 'userId는 필수입니다.' })

    const periodDaysStr = request.query.get('periodDays')
    const periodDays = periodDaysStr ? Number(periodDaysStr) : 30
    if (!Number.isFinite(periodDays) || periodDays <= 0) return jsonResponse(400, { error: 'periodDays는 1 이상의 숫자여야 합니다.' })

    const data = selectionsService.getStats(userId, periodDays)
    return jsonResponse(200, { data, meta: { message: '통계를 조회했습니다.' } })
  } catch (err) {
    context.error('selections-stats error:', err)
    return jsonResponse(500, { error: '통계 조회 중 오류가 발생했습니다.' })
  }
}

app.http('selectionsSave', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'v1/selections',
  handler: selectionsSave,
})

app.http('selectionsHistory', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'v1/selections/history',
  handler: selectionsHistory,
})

app.http('selectionsStats', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'v1/selections/stats',
  handler: selectionsStats,
})

function jsonResponse(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}
