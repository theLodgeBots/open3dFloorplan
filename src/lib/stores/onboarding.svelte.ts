// Onboarding tooltips — track which tips have been shown
const STORAGE_KEY = 'o3d_tips_seen';

export type TipId = 'first-wall' | 'first-furniture' | 'first-3d' | 'first-export' | 'first-door';

export const TIP_MESSAGE_KEYS: Record<TipId, string> = {
  'first-wall': 'onboarding.firstWall',
  'first-furniture': 'onboarding.firstFurniture',
  'first-3d': 'onboarding.first3d',
  'first-export': 'onboarding.firstExport',
  'first-door': 'onboarding.firstDoor',
};

function getSeenTips(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function persist(seen: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
}

/** Returns true if the tip hasn't been shown yet */
export function showTip(tipId: TipId): boolean {
  return !getSeenTips().has(tipId);
}

/** Mark a tip as seen so it won't show again */
export function markTipSeen(tipId: TipId): void {
  const seen = getSeenTips();
  seen.add(tipId);
  persist(seen);
}

// Svelte 5 reactive state for the currently active tip
let _activeTip = $state<{ id: TipId; x: number; y: number } | null>(null);

export function getActiveTip() { return _activeTip; }

/** Trigger a tip at a screen position. No-ops if already seen. */
export function triggerTip(tipId: TipId, x: number, y: number) {
  if (!showTip(tipId)) return;
  _activeTip = { id: tipId, x, y };
}

/** Dismiss the current tip */
export function dismissTip() {
  if (_activeTip) {
    markTipSeen(_activeTip.id);
    _activeTip = null;
  }
}
