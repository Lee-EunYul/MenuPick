-- =====================================================
-- 004_create_user_selections.sql
-- 사용자 선택 이력 테이블
-- 사용자가 어떤 메뉴를 언제 어떤 방법으로 골랐는지 기록한다.
-- 이 데이터가 쌓여야 기능 3(이력 분석 추천)이 동작한다.
-- =====================================================

CREATE TYPE selection_source AS ENUM (
  'question',    -- 질문 기반 추천에서 선택
  'roulette',    -- 랜덤 룰렛에서 선택
  'ai_analysis'  -- AI 이력 분석에서 선택
);

CREATE TABLE user_selections (
  id          UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 어떤 사용자가
  menu_id     UUID             NOT NULL REFERENCES menus(id) ON DELETE CASCADE,  -- 어떤 메뉴를
  source      selection_source NOT NULL,                                         -- 어떤 기능으로 골랐는지
  accepted    BOOLEAN          NOT NULL DEFAULT TRUE,  -- TRUE=선택 확정, FALSE=거절(다시 추천 요청)
  selected_at TIMESTAMPTZ      NOT NULL DEFAULT NOW()  -- 언제 골랐는지
);

-- 사용자별 최근 선택 조회 (이력 분석에 핵심적으로 사용)
CREATE INDEX idx_user_selections_user_date ON user_selections (user_id, selected_at DESC);
-- 메뉴별 선택 횟수 집계용
CREATE INDEX idx_user_selections_menu      ON user_selections (menu_id);
-- 최근 30일 데이터 필터링용
CREATE INDEX idx_user_selections_date      ON user_selections (selected_at DESC);
