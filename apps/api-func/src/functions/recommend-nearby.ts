import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { recommendationService } from '../services'
import { RouletteCategory } from '../services/recommendation.service'

const VALID_CATEGORY = new Set<RouletteCategory>(['korean', 'chinese', 'japanese', 'western', 'fastfood', 'snack', 'all'])

export async function recommendNearby(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const lat = request.query.get('lat')
    const lng = request.query.get('lng')
    const radiusMStr = request.query.get('radiusM')
    const categoryStr = request.query.get('category') as RouletteCategory | null

    if (!lat || !lng) return jsonResponse(400, { error: 'lat, lng는 필수입니다.' })

    const parsedLat = Number(lat)
    const parsedLng = Number(lng)
    const parsedRadius = radiusMStr ? Number(radiusMStr) : 1000

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return jsonResponse(400, { error: 'lat, lng는 숫자여야 합니다.' })
    if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) return jsonResponse(400, { error: 'lat/lng 좌표 범위가 올바르지 않습니다.' })
    if (!Number.isFinite(parsedRadius) || parsedRadius <= 0 || parsedRadius > 10000) return jsonResponse(400, { error: 'radiusM는 1~10000 사이 숫자여야 합니다.' })

    const category: RouletteCategory = categoryStr && VALID_CATEGORY.has(categoryStr) ? categoryStr : 'all'
    const restaurants = recommendationService.getNearbyRestaurants(parsedLat, parsedLng, parsedRadius, category)

    return jsonResponse(200, {
      data: restaurants,
      meta: { message: '근처 음식점 목록을 조회했어요.', total: restaurants.length, radiusM: parsedRadius, category },
    })
  } catch (err) {
    context.error('recommend-nearby error:', err)
    return jsonResponse(500, { error: '근처 음식점 조회 중 서버 오류가 발생했습니다.' })
  }
}

app.http('recommendNearby', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'v1/recommend/restaurants/nearby',
  handler: recommendNearby,
})

function jsonResponse(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}
