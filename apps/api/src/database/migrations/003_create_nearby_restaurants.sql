-- =====================================================
-- 003_create_nearby_restaurants.sql
-- 주변 음식점 테이블
-- 룰렛 실행 시 위치 기반으로 조회한 음식점을 임시 저장한다.
-- 위치 정보는 후보 생성 목적으로만 사용하고 원본 좌표는 단기 캐시 용도로만 보관한다.
-- =====================================================

CREATE TABLE nearby_restaurants (
  id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_place_id VARCHAR(255) NOT NULL,         -- 카카오/구글 등 외부 API에서 부여한 장소 ID
  name              VARCHAR(200) NOT NULL,          -- 음식점 이름
  category          VARCHAR(100) NOT NULL,          -- 음식점 카테고리 (외부 API 원본값)
  lat               DECIMAL(10,7) NOT NULL,         -- 위도 (북위/남위)
  lng               DECIMAL(10,7) NOT NULL,         -- 경도 (동경/서경)
  distance_m        INT          NOT NULL DEFAULT 0, -- 검색 기준점으로부터의 거리 (미터)
  is_open_now       BOOLEAN      NOT NULL DEFAULT FALSE, -- 현재 영업 중 여부
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()  -- 마지막 갱신 일시
);

-- 외부 API 장소 ID로 중복 방지 및 빠른 조회
CREATE UNIQUE INDEX idx_nearby_provider_place ON nearby_restaurants (provider_place_id);
-- 거리 기준 정렬 최적화
CREATE INDEX idx_nearby_distance ON nearby_restaurants (distance_m);
