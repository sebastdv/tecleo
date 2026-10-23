import { Module } from '@nestjs/common';

import { LeaderboardsModule } from '../leaderboards/leaderboards.module.js';
import { RacesController } from '../races/races.controller.js';
import { TextsController } from './texts.controller.js';

@Module({ imports: [LeaderboardsModule], controllers: [TextsController, RacesController] })
export class TextsModule {}
