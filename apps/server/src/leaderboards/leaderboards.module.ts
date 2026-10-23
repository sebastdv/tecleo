import { Module } from '@nestjs/common';

import { DailyController } from '../daily/daily.controller.js';
import { DailyService } from '../daily/daily.service.js';
import { LeaderboardsController } from './leaderboards.controller.js';
import { LeaderboardsService } from './leaderboards.service.js';

/** Rankings y desafío diario (el diario es un ranking más, sobre un texto del día). */
@Module({
  controllers: [LeaderboardsController, DailyController],
  providers: [LeaderboardsService, DailyService],
  exports: [LeaderboardsService, DailyService],
})
export class LeaderboardsModule {}
