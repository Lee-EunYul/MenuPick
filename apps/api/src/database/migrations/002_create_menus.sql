-- =====================================================
-- 002_create_menus.sql
-- 메뉴 테이블
-- 추천 가능한 음식 목록을 저장한다.
-- =====================================================

CREATE TYPE menu_category AS ENUM (
  'korean',     -- 한식
  'chinese',    -- 중식
  'japanese',   -- 일식
  'western',    -- 양식
  'fastfood',   -- 패스트푸드
  'snack',      -- 분식
  'cafe',       -- 카페/디저트
  'etc'         -- 기타
);

CREATE TABLE menus (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100)  NOT NULL,                    -- 메뉴 이름 (예: 치킨, 라멘)
  category    menu_category NOT NULL,                    -- 카테고리
  spicy_level SMALLINT      NOT NULL DEFAULT 0           -- 매운 정도 (0=안 매움, 1=약간, 2=보통, 3=매움)
                            CHECK (spicy_level BETWEEN 0 AND 3),
  price_min   INT           NOT NULL DEFAULT 0,          -- 최소 예상 가격 (원)
  price_max   INT           NOT NULL DEFAULT 0,          -- 최대 예상 가격 (원)
  tags        TEXT[]        NOT NULL DEFAULT '{}',       -- 태그 목록 (예: {'국물', '혼밥', '든든함'})
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,       -- 추천 활성화 여부
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 카테고리별 조회 인덱스
CREATE INDEX idx_menus_category    ON menus (category);
-- 활성 메뉴만 빠르게 필터링
CREATE INDEX idx_menus_is_active   ON menus (is_active);
-- 매운 정도 + 가격으로 복합 검색
CREATE INDEX idx_menus_spicy_price ON menus (spicy_level, price_min, price_max);
