import {
  applyInput,
  blankRun,
  keystrokeToAction,
  type KeystrokeInput,
  type TypingState,
} from '@tecleo/engine';

/**
 * Estado de una prueba grabada en cualquier instante. Avanzar es incremental (solo aplica las
 * pulsaciones nuevas); volver atrás rehace desde el principio.
 */
export class ReplayCursor {
  private state: TypingState;
  private index = 0;
  private time = 0;
  readonly durationMs: number;

  constructor(
    private readonly template: TypingState,
    private readonly keystrokes: readonly KeystrokeInput[],
  ) {
    this.state = blankRun(template);
    this.durationMs = keystrokes.at(-1)?.t ?? 0;
  }

  at(time: number): TypingState {
    if (time < this.time) {
      this.state = blankRun(this.template);
      this.index = 0;
    }
    this.time = time;
    for (; this.index < this.keystrokes.length; this.index++) {
      const keystroke = this.keystrokes[this.index];
      if (!keystroke || keystroke.t > time) break;
      this.state = applyInput(this.state, keystrokeToAction(keystroke), keystroke.t);
    }
    return this.state;
  }
}
