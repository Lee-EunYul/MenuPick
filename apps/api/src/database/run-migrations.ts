/**
 * run-migrations.ts
 * 
 * DB 마이그레이션 실행 스크립트
 * migrations 폴더 안의 SQL 파일을 순서대로 실행해서
 * 테이블을 만들고 샘플 데이터를 넣는다.
 * 
 * 사용법:
 *   npx ts-node src/database/run-migrations.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { Client } from 'pg'

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://menupick_user:menupick_pass@localhost:5432/menupick_db'

async function runMigrations() {
  const client = new Client({ connectionString: DATABASE_URL })

  try {
    console.log('DB 연결 중...')
    await client.connect()
    console.log('DB 연결 성공!')

    const migrationsDir = path.join(__dirname, 'migrations')
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort() // 001_, 002_ 순서로 정렬

    for (const file of files) {
      const filePath = path.join(migrationsDir, file)
      const sql = fs.readFileSync(filePath, 'utf-8')

      console.log(`실행 중: ${file}`)
      await client.query(sql)
      console.log(`완료: ${file} ✅`)
    }

    console.log('\n모든 마이그레이션 완료! 테이블과 샘플 데이터가 준비됐습니다.')
  } catch (error) {
    console.error('마이그레이션 실패:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

runMigrations()
