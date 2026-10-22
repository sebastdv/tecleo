import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';

/** Socket.IO con los mismos orígenes permitidos que la API REST. */
export class CorsIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origins: string[],
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    // Socket.IO tipa sus opciones sin `| undefined`; el objeto completo es válido.
    const merged = {
      ...options,
      cors: { origin: this.origins, credentials: true },
      // Un registro de 20 000 pulsaciones codificado cabe de sobra en 1 MB.
      maxHttpBufferSize: 1_000_000,
    } as ServerOptions;
    return super.createIOServer(port, merged);
  }
}
