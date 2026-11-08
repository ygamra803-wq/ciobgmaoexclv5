import { useEffect } from 'react';

/**
 * SEC-HARDENING-P1 (Batch C): Default inactivity timeout before automatic logout (30 minutes)
 */
export const IDLE_LOGOUT_MS = 30 * 60 * 1000;
export const IDLE_ACTIVITY_THROTTLE_MS = 1000;
export const IDLE_EXPIRED_STORAGE_FLAG = 'gmao_session_idle_expired';

export interface IdleTimerControllerOptions {
  timeoutMs?: number;
  throttleMs?: number;
  onIdle: () => void;
}

/**
 * Pure idle timer controller with throttled activity resets (testable with fake timers).
 */
export function createIdleTimerController({
  timeoutMs = IDLE_LOGOUT_MS,
  throttleMs = IDLE_ACTIVITY_THROTTLE_MS,
  onIdle,
}: IdleTimerControllerOptions) {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let lastActivityTs = 0;
  let stopped = false;

  const scheduleTimer = () => {
    if (stopped) return;
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      if (!stopped) {
        onIdle();
      }
    }, timeoutMs);
  };

  const recordActivity = (force = false) => {
    if (stopped) return;
    const now = Date.now();
    if (!force && now - lastActivityTs < throttleMs) {
      return;
    }
    lastActivityTs = now;
    scheduleTimer();
  };

  const start = () => {
    stopped = false;
    lastActivityTs = Date.now();
    scheduleTimer();
  };

  const stop = () => {
    stopped = true;
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  return {
    start,
    stop,
    recordActivity,
  };
}

/**
 * React hook that monitors user activity (pointerdown, keydown, scroll, touchstart)
 * and triggers automatic logout after `timeoutMs` of inactivity.
 * Only active when `enabled === true` (authenticated & past mustChangePassword gate).
 */
export function useIdleLogout({
  enabled,
  onIdle,
  timeoutMs = IDLE_LOGOUT_MS,
}: {
  enabled: boolean;
  onIdle: () => void;
  timeoutMs?: number;
}) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const controller = createIdleTimerController({
      timeoutMs,
      throttleMs: IDLE_ACTIVITY_THROTTLE_MS,
      onIdle,
    });

    controller.start();

    const handleActivity = () => {
      controller.recordActivity(false);
    };

    const events: Array<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'scroll',
      'touchstart',
    ];

    for (const evt of events) {
      window.addEventListener(evt, handleActivity, { passive: true });
    }

    return () => {
      controller.stop();
      for (const evt of events) {
        window.removeEventListener(evt, handleActivity);
      }
    };
  }, [enabled, onIdle, timeoutMs]);
}
