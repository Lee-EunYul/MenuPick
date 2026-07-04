import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { RecommendationModule } from './recommendation/recommendation.module'
import { SelectionsModule } from './selections/selections.module'

@Module({
  imports: [RecommendationModule, SelectionsModule],
  controllers: [AppController],
})
export class AppModule {}
