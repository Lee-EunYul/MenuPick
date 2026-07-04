export type RouletteCategory =
  | 'korean'
  | 'chinese'
  | 'japanese'
  | 'western'
  | 'fastfood'
  | 'snack'
  | 'all'

export interface RouletteRequestDto {
  category?: RouletteCategory
  excludeMenuIds?: string[]
  lat?: number
  lng?: number
  radiusM?: number
  useNearby?: boolean
}

export interface NearbyRestaurantItem {
  id: string
  name: string
  category: string
  distanceM: number
  isOpenNow: boolean
  lat: number
  lng: number
}
