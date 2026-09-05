export const HANDOFF_LIMITS = {
  maxBytes: 1024 * 1024,
  dailyUploads: 100,
  dailyBytes: 25 * 1024 * 1024,
  minuteUploads: 10,
} as const;

export class HandoffError extends Error {
  constructor(public status: number, message: string, public retryAfter?: number) { super(message); }
}

export interface QuotaState {
  version: 1;
  day: number;
  uploads: number;
  bytes: number;
  minute: number;
  minuteUploads: number;
}
export interface QuotaSnapshot { state: QuotaState; generation: string; metageneration: string }
export interface QuotaStore {
  read(): Promise<QuotaSnapshot | null>;
  /** Compare-and-swap; false means another instance reserved capacity first. */
  write(previous: QuotaSnapshot | null, state: QuotaState): Promise<boolean>;
}

export function parseQuotaState(value: unknown): QuotaState {
  const state = value as QuotaState;
  if (!state || state.version !== 1 ||
    !['day', 'uploads', 'bytes', 'minute', 'minuteUploads'].every(key => {
      const n = state[key as keyof QuotaState];
      return Number.isSafeInteger(n) && n >= 0;
    })) throw new Error('Invalid handoff quota ledger');
  return state;
}

/** Reserve before writing a capture. Failed/uncertain writes remain charged;
 * releasing them could let retries exceed the daily cap. No process-local quota
 * is used as the source of truth: simultaneous App Hosting instances use CAS.
 */
export async function reserveHandoff(store: QuotaStore, bytes: number, now = Date.now()): Promise<void> {
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > HANDOFF_LIMITS.maxBytes) {
    throw new HandoffError(413, 'This plan is too large for link sharing. Use Export Editable Plan (JSON) instead.');
  }
  const day = Math.floor(now / 86_400_000), minute = Math.floor(now / 60_000);
  for (let attempt = 0; attempt < 5; attempt++) {
    const previous = await store.read();
    const state = previous ? parseQuotaState(previous.state) : { version: 1 as const, day, uploads: 0, bytes: 0, minute, minuteUploads: 0 };
    // Do not reset a ledger if an instance's clock has moved backwards.
    if (state.day > day || state.minute > minute) throw new Error('Handoff quota clock mismatch');
    const next: QuotaState = {
      version: 1, day, minute,
      uploads: (state.day === day ? state.uploads : 0) + 1,
      bytes: (state.day === day ? state.bytes : 0) + bytes,
      minuteUploads: (state.minute === minute ? state.minuteUploads : 0) + 1,
    };
    const daily = next.uploads > HANDOFF_LIMITS.dailyUploads || next.bytes > HANDOFF_LIMITS.dailyBytes;
    if (daily || next.minuteUploads > HANDOFF_LIMITS.minuteUploads) {
      const window = daily ? 86_400_000 : 60_000;
      throw new HandoffError(429, 'Free link sharing has reached its limit. Use Export Editable Plan (JSON), or try again later.', Math.max(1, Math.ceil((window - now % window) / 1000)));
    }
    if (await store.write(previous, next)) return;
  }
  throw new HandoffError(503, 'Link sharing is busy. Use Export Editable Plan (JSON), or try again shortly.', 5);
}
