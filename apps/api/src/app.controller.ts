import { Controller, Get } from '@nestjs/common'

@Controller()
export class AppController {
  private readonly startedAt = Date.now()

  // 서버가 제대로 켜졌는지 확인하는 상태 체크 API
  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      message: '메뉴픽 API 서버 정상 동작 중',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      nodeEnv: process.env.NODE_ENV ?? 'development',
      memoryUsage: process.memoryUsage(),
    }
  }

  @Get('health/live')
  livenessCheck() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    }
  }

  @Get('health/ready')
  readinessCheck() {
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    }
  }
}
