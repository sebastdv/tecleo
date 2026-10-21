import { Module } from '@nestjs/common';

import { RacesController } from '../races/races.controller.js';
import { TextsController } from './texts.controller.js';

@Module({ controllers: [TextsController, RacesController] })
export class TextsModule {}
