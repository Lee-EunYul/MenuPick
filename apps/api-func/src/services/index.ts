import { RecommendationService } from './recommendation.service'
import { SelectionsService } from './selections.service'

// 모듈 수준 싱글턴 — 동일 Function App 인스턴스 내에서는 유지됨
export const selectionsService = new SelectionsService()
export const recommendationService = new RecommendationService()
