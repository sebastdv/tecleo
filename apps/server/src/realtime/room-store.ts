import { Injectable } from '@nestjs/common';

import type { Room } from './room.js';

/**
 * Dónde viven las salas. Hoy en memoria del proceso; detrás de esta interfaz se puede pasar a
 * Redis (varias instancias del servidor) sin tocar la lógica de las salas.
 */
export abstract class RoomStore {
  abstract get(code: string): Room | undefined;
  abstract save(room: Room): void;
  abstract delete(code: string): void;
  abstract all(): Iterable<Room>;
  /** Sala en la que está un jugador (para reconectarlo). */
  abstract roomOf(playerId: string): Room | undefined;
}

@Injectable()
export class InMemoryRoomStore extends RoomStore {
  private readonly rooms = new Map<string, Room>();

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  save(room: Room): void {
    this.rooms.set(room.code, room);
  }

  delete(code: string): void {
    this.rooms.delete(code);
  }

  all(): Iterable<Room> {
    return this.rooms.values();
  }

  roomOf(playerId: string): Room | undefined {
    for (const room of this.rooms.values()) if (room.players.has(playerId)) return room;
    return undefined;
  }
}
