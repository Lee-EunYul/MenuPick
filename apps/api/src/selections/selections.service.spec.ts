import { SelectionsService } from './selections.service'

describe('SelectionsService', () => {
  let service: SelectionsService

  beforeEach(() => {
    service = new SelectionsService()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('saveSelection should default accepted to true and include menu summary', () => {
    jest.setSystemTime(new Date('2026-06-28T00:00:00.000Z'))

    const saved = service.saveSelection({
      userId: 'user-001',
      menuId: 'menu-011',
      source: 'question',
    })

    expect(saved.accepted).toBe(true)
    expect(saved.menu).toMatchObject({
      id: 'menu-011',
      name: '짜장면',
      category: 'chinese',
    })
    expect(saved.selectedAt).toBe('2026-06-28T00:00:00.000Z')
  })

  it('getStats should aggregate acceptance/source/category for period', () => {
    jest.setSystemTime(new Date('2026-06-28T00:00:00.000Z'))

    service.saveSelection({ userId: 'user-001', menuId: 'menu-011', source: 'question', accepted: true })
    service.saveSelection({ userId: 'user-001', menuId: 'menu-012', source: 'question', accepted: false })
    service.saveSelection({ userId: 'user-001', menuId: 'menu-005', source: 'roulette', accepted: true })
    service.saveSelection({ userId: 'user-002', menuId: 'menu-005', source: 'question', accepted: true })

    const stats = service.getStats('user-001', 30)

    expect(stats.totalSelections).toBe(3)
    expect(stats.acceptedCount).toBe(2)
    expect(stats.acceptanceRate).toBe(66.7)
    expect(stats.bySource).toEqual({
      question: 2,
      roulette: 1,
      ai_analysis: 0,
    })
    expect(stats.byCategory).toEqual({
      chinese: 2,
      korean: 1,
    })
    expect(stats.topCategory).toBe('chinese')
  })

  it('getRejectedMenuIds should return menu IDs rejected three times or more', () => {
    jest.setSystemTime(new Date('2026-06-28T00:00:00.000Z'))

    service.saveSelection({ userId: 'user-001', menuId: 'menu-011', source: 'question', accepted: false })
    service.saveSelection({ userId: 'user-001', menuId: 'menu-011', source: 'question', accepted: false })
    service.saveSelection({ userId: 'user-001', menuId: 'menu-011', source: 'question', accepted: false })
    service.saveSelection({ userId: 'user-001', menuId: 'menu-012', source: 'question', accepted: false })

    expect(service.getRejectedMenuIds('user-001', 30)).toEqual(['menu-011'])
  })

  it('getRecentMenuIds should return only accepted IDs ordered by recency', () => {
    jest.setSystemTime(new Date('2026-06-28T00:00:00.000Z'))
    service.saveSelection({ userId: 'user-001', menuId: 'menu-011', source: 'question', accepted: true })

    jest.setSystemTime(new Date('2026-06-28T00:00:02.000Z'))
    service.saveSelection({ userId: 'user-001', menuId: 'menu-012', source: 'question', accepted: false })

    jest.setSystemTime(new Date('2026-06-28T00:00:03.000Z'))
    service.saveSelection({ userId: 'user-001', menuId: 'menu-005', source: 'roulette', accepted: true })

    expect(service.getRecentMenuIds('user-001', 10)).toEqual(['menu-005', 'menu-011'])
  })
})
