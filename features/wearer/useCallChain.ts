import { useCallback, useState } from 'react';
import { dial, EMERGENCY_NUMBER } from '@/services/calls/dial';

export type CallTarget = { name: string; number: string };
type Chain = { at: number | null; answered: boolean; failed: boolean };

const IDLE: Chain = { at: null, answered: false, failed: false };

/**
 * Calls the emergency contacts one after another from the phone: opens the dialer for contact 1, then asks "did they
 * answer?". "No" opens the dialer for the next contact, and after the last one 112 is the final option. The dialer
 * takes the app to the background, so the question waits on screen for when the person comes back. In a drill 112 is
 * never dialled. PENDING BACKEND: the server placing the calls (and reporting who answered) replaces this later.
 */
export function useCallChain(targets: CallTarget[], opts: { drill: boolean }) {
  const [chain, setChain] = useState<Chain>(IDLE);

  const call = useCallback(async (number: string) => {
    const ok = await dial(number);
    if (!ok) setChain((c) => ({ ...c, failed: true }));
  }, []);

  const start = useCallback(() => {
    if (!targets.length) return;
    setChain({ at: 0, answered: false, failed: false });
    void call(targets[0].number);
  }, [targets, call]);

  const again = useCallback(() => {
    setChain((c) => ({ ...c, failed: false }));
    if (chain.at === null) return;
    if (chain.at < targets.length) void call(targets[chain.at].number);
    else if (!opts.drill) void call(EMERGENCY_NUMBER);
  }, [chain.at, targets, call, opts.drill]);

  const answered = useCallback(() => setChain((c) => ({ ...c, answered: true })), []);

  const next = useCallback(() => {
    if (chain.at === null) return;
    const at = chain.at + 1;
    setChain({ at, answered: false, failed: false });
    if (at < targets.length) void call(targets[at].number);
    else if (!opts.drill) void call(EMERGENCY_NUMBER);
  }, [chain.at, targets, call, opts.drill]);

  const reset = useCallback(() => setChain(IDLE), []);

  const at = chain.at;
  const phase =
    at === null ? 'idle' : chain.answered ? 'answered' : at < targets.length ? 'asking' : 'emergency';
  return {
    phase,
    at,
    current: at !== null ? targets[at] : undefined,
    failed: chain.failed,
    start,
    again,
    answered,
    next,
    reset,
  };
}
