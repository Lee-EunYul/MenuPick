-- =====================================================
-- 001_create_users.sql
-- 사용자 테이블
-- 메뉴픽을 사용하는 각 사람의 정보를 저장한다.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- UUID 자동 생성 기능 활성화

CREATE TABLE users (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(), -- 사용자 고유 번호 (자동 생성)
  nickname   VARCHAR(50) NOT NULL,                               -- 닉네임
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                  -- 가입 일시
);

-- 닉네임으로 빠르게 검색하기 위한 인덱스
CREATE INDEX idx_users_nickname ON users (nickname);
