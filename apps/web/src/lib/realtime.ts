'use client';

import { estimateClock, EVENTS, timePongSchema, type ClockSample } from '@tecleo/shared';
import { io, type Socket } from 'socket.io-client';
import { z } from 'zod';

import { useAuthStore } from '@/auth/auth-store';

import { refreshSession } from './api';

/**
 * Conexión de tiempo real con el servidor (spec 7). Va directo al server (no por el proxy de
 * Next): la identidad viaja en el handshake, no en cookies.
 */
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4100';
const GUEST_KEY = 'tecleo-guest';
const CLOCK_SAMPLES = 5;

const guestSchema = z.object({ id: z.uuid(), name: z.string().max(20) });
export type GuestIdentity = z.infer<typeof guestSchema>;

/** Identidad de invitado de este navegador: un id estable (para volver a la sala) y un nombre. */
export function readGuest(): GuestIdentity {
  try {
    const parsed = guestSchema.safeParse(JSON.parse(localStorage.getItem(GUEST_KEY) ?? 'null'));
    if (parsed.success) return parsed.data;
  } catch {
    // Almacenamiento bloqueado o dato corrupto: se crea uno nuevo.
  }
  const guest = { id: crypto.randomUUID(), name: '' };
  writeGuest(guest);
  return guest;
}

function writeGuest(guest: GuestIdentity): void {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
  } catch {
    // Sin almacenamiento el invitado dura lo que la pestaña.
  }
}

/** Cambia el nombre de invitado; se usa en la próxima conexión. */
export function setGuestName(name: string): void {
  writeGuest({ ...readGuest(), name: name.slice(0, 20) });
  // Si ya hay conexión, se rehace para que el servidor vea el nombre nuevo.
  if (socket?.connected) socket.disconnect().connect();
}

/** Id con el que el servidor identifica a quien usa este navegador. */
export function selfId(): string {
  const { user } = useAuthStore.getState();
  return user ? `user:${user.id}` : `guest:${readGuest().id}`;
}

let socket: Socket | null = null;
/** Desfase con el reloj del servidor: `Date.now() + offset` ≈ hora del servidor. */
let clockOffset = 0;
let clockReady: Promise<void> | null = null;

/** Segundos de vida que le quedan a un JWT (sin verificarlo: solo para saber si renovarlo). */
function secondsLeft(token: string): number {
  try {
    const payload = z
      .object({ exp: z.number() })
      .parse(JSON.parse(atob((token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'))));
    return payload.exp - Date.now() / 1_000;
  } catch {
    return 0;
  }
}

/**
 * Datos del handshake. Un access token vencido haría que el servidor tome a la persona por
 * invitada (y la saque de su carrera al reconectar): se renueva antes de mandarlo.
 */
function handshake(callback: (data: object) => void): void {
  void (async () => {
    let { accessToken } = useAuthStore.getState();
    if (accessToken && secondsLeft(accessToken) < 30) {
      accessToken = (await refreshSession().catch(() => null))?.accessToken ?? null;
    }
    if (accessToken) {
      callback({ token: accessToken });
      return;
    }
    const guest = readGuest();
    callback({ guestId: guest.id, ...(guest.name && { guestName: guest.name }) });
  })();
}

async function syncClock(target: Socket): Promise<void> {
  const samples: ClockSample[] = [];
  for (let index = 0; index < CLOCK_SAMPLES; index++) {
    const sent = Date.now();
    const pong = timePongSchema.safeParse(
      await target.timeout(5_000).emitWithAck(EVENTS.timePing, { clientTime: sent }),
    );
    if (pong.success) samples.push({ sent, server: pong.data.serverTime, received: Date.now() });
  }
  if (samples.length > 0) clockOffset = estimateClock(samples).offset;
}

/** El socket compartido; se conecta la primera vez que se pide. */
export function getSocket(): Socket {
  if (socket) return socket;
  const created = io(SOCKET_URL, {
    auth: handshake,
    transports: ['websocket'],
    autoConnect: false,
  });
  // Cada (re)conexión vuelve a medir el reloj: la red pudo cambiar.
  created.on('connect', () => {
    clockReady = syncClock(created).catch(() => undefined);
  });
  // Al entrar o salir de la cuenta, la identidad cambia: se reconecta con la nueva.
  let lastUserId = useAuthStore.getState().user?.id ?? null;
  useAuthStore.subscribe((state) => {
    const current = state.user?.id ?? null;
    if (current === lastUserId || state.status === 'unknown') return;
    lastUserId = current;
    if (created.connected) created.disconnect().connect();
  });
  socket = created;
  return created;
}

/** Conecta (si hace falta) y espera a tener el reloj sincronizado. */
export async function connectRealtime(): Promise<Socket> {
  const target = getSocket();
  if (!target.connected) {
    await new Promise<void>((resolve, reject) => {
      const onConnect = () => {
        target.off('connect_error', onError);
        resolve();
      };
      const onError = (error: Error) => {
        target.off('connect', onConnect);
        reject(error);
      };
      target.once('connect', onConnect);
      target.once('connect_error', onError);
      target.connect();
    });
  }
  await clockReady;
  return target;
}

/** Hora del servidor (epoch ms) llevada al reloj de `performance.now()` de esta página. */
export function serverToLocal(serverTime: number): number {
  return performance.now() + (serverTime - clockOffset - Date.now());
}
