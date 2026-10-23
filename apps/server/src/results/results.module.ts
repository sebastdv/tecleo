import { Module } from '@nestjs/common';

import { LeaderboardsModule } from '../leaderboards/leaderboards.module.js';
import { ResultsController } from './results.controller.js';
import { ResultsService } from './results.service.js';

@Module({
  imports: [LeaderboardsModule],
  controllers: [ResultsController],
  providers: [ResultsService],
})
export class ResultsModule {}
