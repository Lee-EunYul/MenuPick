export type MenuCategory =
  | 'korean'
  | 'chinese'
  | 'japanese'
  | 'western'
  | 'fastfood'
  | 'snack'

export interface Menu {
  id: string
  name: string
  category: MenuCategory
  spicyLevel: 0 | 1 | 2 | 3
  priceMin: number
  priceMax: number
  tags: string[]
}

export const SAMPLE_MENUS: Menu[] = [
  { id: 'menu-001', name: '치킨', category: 'korean', spicyLevel: 1, priceMin: 18000, priceMax: 25000, tags: ['배달', '야식', '혼술', '모임'] },
  { id: 'menu-002', name: '삼겹살', category: 'korean', spicyLevel: 0, priceMin: 12000, priceMax: 18000, tags: ['회식', '모임', '든든함', '고기'] },
  { id: 'menu-003', name: '김치찌개', category: 'korean', spicyLevel: 2, priceMin: 7000, priceMax: 10000, tags: ['국물', '혼밥', '따뜻함', '집밥'] },
  { id: 'menu-004', name: '된장찌개', category: 'korean', spicyLevel: 0, priceMin: 7000, priceMax: 10000, tags: ['국물', '혼밥', '따뜻함', '집밥'] },
  { id: 'menu-005', name: '비빔밥', category: 'korean', spicyLevel: 1, priceMin: 8000, priceMax: 12000, tags: ['혼밥', '건강', '채소'] },
  { id: 'menu-006', name: '냉면', category: 'korean', spicyLevel: 1, priceMin: 9000, priceMax: 14000, tags: ['여름', '시원함', '혼밥'] },
  { id: 'menu-007', name: '순대국밥', category: 'korean', spicyLevel: 1, priceMin: 7000, priceMax: 10000, tags: ['국물', '든든함', '해장', '저렴'] },
  { id: 'menu-008', name: '설렁탕', category: 'korean', spicyLevel: 0, priceMin: 9000, priceMax: 13000, tags: ['국물', '든든함', '해장'] },
  { id: 'menu-009', name: '제육볶음', category: 'korean', spicyLevel: 2, priceMin: 8000, priceMax: 12000, tags: ['혼밥', '매운맛', '밥도둑'] },
  { id: 'menu-010', name: '갈비탕', category: 'korean', spicyLevel: 0, priceMin: 12000, priceMax: 18000, tags: ['국물', '든든함', '특식'] },
  { id: 'menu-011', name: '짜장면', category: 'chinese', spicyLevel: 0, priceMin: 6000, priceMax: 9000, tags: ['배달', '혼밥', '저렴', '면'] },
  { id: 'menu-012', name: '짬뽕', category: 'chinese', spicyLevel: 2, priceMin: 7000, priceMax: 10000, tags: ['배달', '국물', '매운맛', '면'] },
  { id: 'menu-013', name: '탕수육', category: 'chinese', spicyLevel: 0, priceMin: 15000, priceMax: 22000, tags: ['배달', '모임', '고기'] },
  { id: 'menu-014', name: '마라탕', category: 'chinese', spicyLevel: 3, priceMin: 12000, priceMax: 18000, tags: ['매운맛', '트렌드', '모임'] },
  { id: 'menu-015', name: '딤섬', category: 'chinese', spicyLevel: 0, priceMin: 15000, priceMax: 25000, tags: ['특식', '모임', '브런치'] },
  { id: 'menu-016', name: '초밥', category: 'japanese', spicyLevel: 0, priceMin: 15000, priceMax: 30000, tags: ['특식', '모임', '신선함'] },
  { id: 'menu-017', name: '라멘', category: 'japanese', spicyLevel: 1, priceMin: 10000, priceMax: 15000, tags: ['국물', '면', '혼밥'] },
  { id: 'menu-018', name: '돈카츠', category: 'japanese', spicyLevel: 0, priceMin: 10000, priceMax: 15000, tags: ['혼밥', '든든함', '고기'] },
  { id: 'menu-019', name: '우동', category: 'japanese', spicyLevel: 0, priceMin: 8000, priceMax: 12000, tags: ['국물', '면', '가벼움'] },
  { id: 'menu-020', name: '규동', category: 'japanese', spicyLevel: 0, priceMin: 8000, priceMax: 13000, tags: ['혼밥', '빠름', '든든함'] },
  { id: 'menu-021', name: '파스타', category: 'western', spicyLevel: 0, priceMin: 12000, priceMax: 20000, tags: ['데이트', '혼밥', '면'] },
  { id: 'menu-022', name: '피자', category: 'western', spicyLevel: 0, priceMin: 18000, priceMax: 30000, tags: ['배달', '모임', '야식'] },
  { id: 'menu-023', name: '스테이크', category: 'western', spicyLevel: 0, priceMin: 25000, priceMax: 60000, tags: ['특식', '데이트', '고기'] },
  { id: 'menu-024', name: '샐러드', category: 'western', spicyLevel: 0, priceMin: 8000, priceMax: 15000, tags: ['건강', '가벼움', '다이어트'] },
  { id: 'menu-025', name: '버거', category: 'western', spicyLevel: 0, priceMin: 8000, priceMax: 15000, tags: ['패스트푸드', '혼밥', '빠름'] },
  { id: 'menu-026', name: '햄버거세트', category: 'fastfood', spicyLevel: 0, priceMin: 7000, priceMax: 12000, tags: ['빠름', '혼밥', '저렴'] },
  { id: 'menu-027', name: '핫도그', category: 'fastfood', spicyLevel: 0, priceMin: 3000, priceMax: 6000, tags: ['간식', '저렴', '빠름'] },
  { id: 'menu-028', name: '떡볶이', category: 'snack', spicyLevel: 2, priceMin: 4000, priceMax: 8000, tags: ['간식', '매운맛', '저렴', '혼밥'] },
  { id: 'menu-029', name: '김밥', category: 'snack', spicyLevel: 0, priceMin: 3000, priceMax: 6000, tags: ['간편', '혼밥', '저렴', '빠름'] },
  { id: 'menu-030', name: '라볶이', category: 'snack', spicyLevel: 2, priceMin: 5000, priceMax: 9000, tags: ['간식', '매운맛', '면', '저렴'] },
]
