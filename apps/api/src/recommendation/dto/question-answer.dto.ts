/**
 * question-answer.dto.ts
 *
 * 사용자가 질문에 답변한 내용을 담는 타입 정의
 * DTO = Data Transfer Object, 즉 "데이터를 전달하는 그릇"
 *
 * 질문은 최대 5개. 모두 선택 사항(optional)이라
 * 답변 안 한 항목은 추천에서 조건으로 사용하지 않는다.
 */

/** Q1. 예산 */
export type BudgetLevel = 'cheap' | 'mid' | 'high'
// cheap = 1만원 이하 / mid = 1~2만원 / high = 2만원 초과

/** Q2. 매운맛 선호 */
export type SpicyPreference = 'none' | 'little' | 'medium' | 'hot'
// none=0  little=1  medium=2  hot=3

/** Q3. 국물 여부 */
export type BrothPreference = 'yes' | 'no' | 'any'

/** Q4. 혼밥 vs 모임 */
export type DiningStyle = 'solo' | 'group' | 'any'

/** Q5. 선호 카테고리 */
export type CategoryPreference =
  | 'korean'
  | 'chinese'
  | 'japanese'
  | 'western'
  | 'fastfood'
  | 'snack'
  | 'any'

/** 질문 전체 묶음 */
export interface QuestionAnswerDto {
  budget?: BudgetLevel
  spicy?: SpicyPreference
  broth?: BrothPreference
  diningStyle?: DiningStyle
  category?: CategoryPreference
}
