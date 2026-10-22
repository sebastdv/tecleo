import { Module } from '@nestjs/common';

import { ENV, type Env } from '../config/config.module.js';
import { PrismaRaceRecorder, PrismaTextPicker } from './prisma-adapters.js';
import { RealtimeGateway } from './realtime.gateway.js';
import { InMemoryRoomStore, RoomStore } from './room-store.js';
import {
  CLOCK,
  RaceRecorder,
  ROOM_TIMINGS,
  RoomsService,
  TextPicker,
  type RoomTimings,
} from './rooms.service.js';

@Module({
  providers: [
    RoomsService,
    RealtimeGateway,
    { provide: RoomStore, useClass: InMemoryRoomStore },
    { provide: TextPicker, useClass: PrismaTextPicker },
    { provide: RaceRecorder, useClass: PrismaRaceRecorder },
    { provide: CLOCK, useValue: () => Date.now() },
    {
      provide: ROOM_TIMINGS,
      inject: [ENV],
      useFactory: (env: Env): RoomTimings => ({
        matchmakingWaitMs: env.MATCHMAKING_WAIT_MS,
        countdownMs: env.COUNTDOWN_MS,
        reconnectGraceMs: env.RECONNECT_GRACE_MS,
        broadcastMs: 150,
        finishedTtlMs: 120_000,
      }),
    },
  ],
})
export class RealtimeModule {}
