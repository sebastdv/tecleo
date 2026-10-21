import { gunzipSync, gzipSync } from 'node:zlib';

import type { EncodedKeystrokes } from '@tecleo/engine';
import { encodedKeystrokesSchema, type EncodedKeystrokesInput } from '@tecleo/shared';

/** Pulsaciones comprimidas para la columna `RaceResult.keystrokes` (~1–3 KB por carrera). */
export function packKeystrokes(encoded: EncodedKeystrokes): Uint8Array<ArrayBuffer> {
  return new Uint8Array(gzipSync(JSON.stringify(encoded)));
}

export function unpackKeystrokes(data: Uint8Array): EncodedKeystrokesInput {
  return encodedKeystrokesSchema.parse(JSON.parse(gunzipSync(data).toString('utf8')));
}
