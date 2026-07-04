import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { recommendationService } from '../services'
import { RouletteCategory, RouletteRequestDto } from '../services/recommendation.service'

const VALID_CATEGORY = new Set<RouletteCategory>(['korean', 'chinese', 'japanese', 'western', 'fastfood', 'snack', 'all'])

export async function recommendRoulette(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as Record<string, unknown>

    const input: RouletteRequestDto = {}
    if (body.category && VALID_CATEGORY.has(body.category as RouletteCategory)) input.category = body.category as RouletteCategory
    if (Array.isArray(body.excludeMenuIds)) input.excludeMenuIds = body.excludeMenuIds.filter((x) => typeof x === 'string')
    if (typeof body.lat === 'number') input.lat = body.lat
    if (typeof body.lng === 'number') input.lng = body.lng
    if (typeof body.radiusM === 'number' && body.radiusM > 0 && body.radiusM <= 10000) input.radiusM = body.radiusM
    if (typeof body.useNearby === 'boolean') input.useNearby = body.useNearby

    const result = recommendationService.spinRoulette(input)

    return jsonResponse(200, {
      data: result,
      meta: {
        message: '룰렛 결과가 확정되었습니다.',
        totalCandidates: result.candidates.length,
        nearbyMode: input.useNearby === true,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '룰렛 실행 중 오류가 발생했습니다.'
    context.error('recommend-roulette error:', err)
    return jsonResponse(400, { error: message })
  }
}

app.http('recommendRoulette', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'v1/recommend/roulette',
  handler: recommendRoulette,
})

function jsonResponse(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}
