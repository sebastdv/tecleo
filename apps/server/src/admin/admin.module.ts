import { Module } from '@nestjs/common';

import { AdminTextsService } from './admin-texts.service.js';
import { AdminController } from './admin.controller.js';
import { AdminGuard } from './admin.guard.js';

@Module({ controllers: [AdminController], providers: [AdminTextsService, AdminGuard] })
export class AdminModule {}
