import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { AppModule } from './app.module'
import { loadRuntimeConfig } from './config/runtime.config'

async function bootstrap() {
  const logger = new Logger('Bootstrap')
  const runtime = loadRuntimeConfig()
  const app = await NestFactory.create(AppModule)

  app.enableShutdownHooks()
  app.enableCors({
    origin: runtime.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })

  // API 주소 앞에 /api/v1 을 자동으로 붙임
  app.setGlobalPrefix('api/v1')

  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled rejection: ${String(reason)}`)
  })

  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception: ${error.message}`, error.stack)
  })

  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true

    logger.warn(`${signal} 수신: API 서버를 정상 종료합니다.`)
    const forceExitTimer = setTimeout(() => {
      logger.error(`정상 종료 제한 시간(${runtime.shutdownTimeoutMs}ms) 초과로 강제 종료합니다.`)
      process.exit(1)
    }, runtime.shutdownTimeoutMs)

    try {
      await app.close()
      clearTimeout(forceExitTimer)
      logger.log('API 서버 종료 완료')
      process.exit(0)
    } catch (error) {
      clearTimeout(forceExitTimer)
      logger.error('서버 종료 중 오류가 발생했습니다.', error instanceof Error ? error.stack : undefined)
      process.exit(1)
    }
  }

  process.on('SIGINT', () => {
    void shutdown('SIGINT')
  })
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM')
  })

  await app.listen(runtime.port)
  logger.log(`메뉴픽 API 서버 실행 중 → http://localhost:${runtime.port}/api/v1`)
  logger.log(`운영 설정: nodeEnv=${runtime.nodeEnv}, corsOrigins=${runtime.corsOrigins.join(',')}`)
}

bootstrap()
