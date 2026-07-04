/**
 * selections.controller.ts
 *
 * 선택 기록 저장/조회 API
 */

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common'
import {
  CreateSelectionDto,
  HistoryQueryDto,
  SelectionSource,
  StatsQueryDto,
} from './dto/create-selection.dto'
import { SelectionsService } from './selections.service'

@Controller('selections')
export class SelectionsController {
  constructor(private readonly selectionsService: SelectionsService) {}

  /**
   * POST /api/v1/selections
   */
  @Post()
  save(@Body() body: CreateSelectionDto) {
    this.validateCreateInput(body)

    if (!this.selectionsService.hasMenu(body.menuId)) {
      throw new BadRequestException('존재하지 않는 menuId 입니다.')
    }

    const data = this.selectionsService.saveSelection(body)

    return {
      data,
      meta: {
        message: '선택 기록이 저장되었습니다.',
      },
    }
  }

  /**
   * GET /api/v1/selections/history?userId=u1&from=2026-06-01&to=2026-06-30
   */
  @Get('history')
  history(@Query() query: HistoryQueryDto) {
    if (!query.userId) {
      throw new BadRequestException('userId는 필수입니다.')
    }

    const data = this.selectionsService.getHistory(query.userId, query.from, query.to)

    return {
      data,
      meta: {
        total: data.length,
      },
    }
  }

  /**
   * GET /api/v1/selections/stats?userId=u1&periodDays=30
   */
  @Get('stats')
  stats(@Query() query: StatsQueryDto) {
    if (!query.userId) {
      throw new BadRequestException('userId는 필수입니다.')
    }

    const periodDays = query.periodDays ? Number(query.periodDays) : 30
    if (!Number.isFinite(periodDays) || periodDays <= 0) {
      throw new BadRequestException('periodDays는 1 이상의 숫자여야 합니다.')
    }

    const data = this.selectionsService.getStats(query.userId, periodDays)

    return {
      data,
      meta: {
        message: '선택 통계 조회 완료',
      },
    }
  }

  private validateCreateInput(body: CreateSelectionDto) {
    if (!body.userId) {
      throw new BadRequestException('userId는 필수입니다.')
    }

    if (!body.menuId) {
      throw new BadRequestException('menuId는 필수입니다.')
    }

    const validSources: SelectionSource[] = ['question', 'roulette', 'ai_analysis']
    if (!body.source || !validSources.includes(body.source)) {
      throw new BadRequestException('source는 question | roulette | ai_analysis 중 하나여야 합니다.')
    }
  }
}
