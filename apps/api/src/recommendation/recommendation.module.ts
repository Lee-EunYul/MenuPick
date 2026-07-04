/**
 * recommendation.module.ts
 *
 * 추천 기능을 하나로 묶는 모듈
 * "모듈" = 관련 파일들을 하나의 기능 단위로 묶은 패키지
 */

import { Module } from '@nestjs/common'
import { RecommendationController } from './recommendation.controller'
import { RecommendationService } from './recommendation.service'
import { SelectionsModule } from '../selections/selections.module'

@Module({
  imports: [SelectionsModule],
  controllers: [RecommendationController],
  providers: [RecommendationService],
})
export class RecommendationModule {}
