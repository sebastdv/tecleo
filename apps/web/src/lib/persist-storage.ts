import { createJSONStorage, type PersistStorage } from 'zustand/middleware';

/**
 * `localStorage` para los stores persistidos, que no escribe nada hasta haber leído.
 *
 * Los stores usan `skipHydration` y se rehidratan tras montar. Si antes de eso alguien hace
 * `set()` (por ejemplo, la limpieza de un efecto), `persist` escribiría el estado por defecto
 * encima de lo guardado y la rehidratación leería ya el valor pisado.
 */
export function readFirstStorage<T>(): PersistStorage<T> | undefined {
  const storage = createJSONStorage<T>(() => localStorage);
  if (!storage) return undefined;
  let read = false;
  return {
    getItem: (name) => {
      read = true;
      return storage.getItem(name);
    },
    setItem: (name, value) => {
      if (read) return storage.setItem(name, value);
    },
    removeItem: (name) => storage.removeItem(name),
  };
}
