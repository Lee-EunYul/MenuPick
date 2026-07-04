-- =====================================================
-- 005_create_preference_profiles.sql
-- 사용자 취향 프로필 테이블
-- 사용자가 설정한 선호/비선호 정보를 저장한다.
-- 추천과 룰렛 필터링에 모두 사용된다.
-- =====================================================

CREATE TABLE preference_profiles (
  user_id              UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferred_categories TEXT[]      NOT NULL DEFAULT '{}',  -- 선호 카테고리 목록
  avoid_tags           TEXT[]      NOT NULL DEFAULT '{}',  -- 피하고 싶은 태그 (예: {'고수', '내장'})
  budget_level         SMALLINT    NOT NULL DEFAULT 1      -- 평소 예산 수준 (0=저렴, 1=보통, 2=고급)
                                   CHECK (budget_level BETWEEN 0 AND 2),
  spicy_preference     SMALLINT    NOT NULL DEFAULT 1      -- 선호 매운 정도 (0~3)
                                   CHECK (spicy_preference BETWEEN 0 AND 3),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
