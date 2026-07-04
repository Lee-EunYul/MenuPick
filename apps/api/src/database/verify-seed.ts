/**
 * verify-seed.ts
 * 
 * 샘플 메뉴 데이터 검증 스크립트
 * DB 없이도 메뉴 데이터가 올바르게 구성됐는지 바로 확인한다.
 * 
 * 사용법:
 *   npx ts-node src/database/verify-seed.ts
 */

import { SAMPLE_MENUS } from './seed-data'

function verify() {
  console.log('=== 메뉴픽 샘플 데이터 검증 ===\n')

  // 전체 개수
  console.log(`총 메뉴 수: ${SAMPLE_MENUS.length}개\n`)

  // 카테고리별 개수
  const byCategory = SAMPLE_MENUS.reduce<Record<string, number>>((acc, menu) => {
    acc[menu.category] = (acc[menu.category] ?? 0) + 1
    return acc
  }, {})

  const categoryNames: Record<string, string> = {
    korean: '한식',
    chinese: '중식',
    japanese: '일식',
    western: '양식',
    fastfood: '패스트푸드',
    snack: '분식',
  }

  console.log('카테고리별 메뉴 수:')
  for (const [cat, count] of Object.entries(byCategory)) {
    console.log(`  ${categoryNames[cat] ?? cat}: ${count}개`)
  }

  // 매운 정도 분포
  const bySpicy = SAMPLE_MENUS.reduce<Record<number, number>>((acc, menu) => {
    acc[menu.spicyLevel] = (acc[menu.spicyLevel] ?? 0) + 1
    return acc
  }, {})

  console.log('\n매운 정도 분포:')
  const spicyLabels = ['안매움(0)', '약간(1)', '보통(2)', '매움(3)']
  for (const [level, count] of Object.entries(bySpicy)) {
    console.log(`  ${spicyLabels[Number(level)]}: ${count}개`)
  }

  // 가격대 분포
  const cheap  = SAMPLE_MENUS.filter((m) => m.priceMax <= 10000).length
  const mid    = SAMPLE_MENUS.filter((m) => m.priceMax > 10000 && m.priceMax <= 20000).length
  const pricey = SAMPLE_MENUS.filter((m) => m.priceMax > 20000).length

  console.log('\n가격대 분포:')
  console.log(`  저렴 (1만원 이하): ${cheap}개`)
  console.log(`  중간 (1~2만원):   ${mid}개`)
  console.log(`  고급 (2만원 초과): ${pricey}개`)

  // 샘플 출력 3개
  console.log('\n샘플 메뉴 3개:')
  SAMPLE_MENUS.slice(0, 3).forEach((m) => {
    console.log(`  - ${m.name} (${categoryNames[m.category]}) | 매운맛:${m.spicyLevel} | ${m.priceMin.toLocaleString()}~${m.priceMax.toLocaleString()}원 | 태그: ${m.tags.join(', ')}`)
  })

  console.log('\n✅ 샘플 데이터 검증 완료!')
}

verify()
