import { useCallback, useEffect, useRef, useState } from 'react';
import { useHousehold } from '@/features/household/store';
import { activatePendant, getPairingChallenge } from '@/services/household/wearerApi';
import { pendant, type FoundPendant } from '@/services/pendant';
import { useWearer } from './store';

export type PairingPhase = 'ready' | 'scanning' | 'found' | 'pairing' | 'paired' | 'failed';

/** How long to look for a pendant in pairing mode before saying it was not found. */
export const SCAN_TIMEOUT_MS = 20_000;

/**
 * C3 · Pairing listens for a real pendant signal (`pairing_press` from Bluetooth / simulator), then scans,
 * connects (OS Pair prompt; pendant ticks and says "Connected"), and completes the signed-challenge verify.
 * Screens never talk to BLE directly — only through `pendant()`.
 */
export function usePairing() {
  const [phase, setPhaseState] = useState<PairingPhase>('ready');
  const phaseRef = useRef<PairingPhase>('ready');
  const setPhase = useCallback((p: PairingPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);
  const [found, setFound] = useState<FoundPendant[]>([]);
  const [error, setError] = useState<unknown>(null);
  const stopScan = useRef<(() => void) | null>(null);

  useEffect(() => () => stopScan.current?.(), []);

  const scan = useCallback(() => {
    stopScan.current?.();
    setError(null);
    setFound([]);
    setPhase('scanning');
    stopScan.current = pendant().scan(
      (p) => {
        setFound((list) => (list.some((f) => f.id === p.id) ? list : [...list, p]));
        if (phaseRef.current === 'scanning') setPhase('found');
      },
      {
        timeoutMs: SCAN_TIMEOUT_MS,
        onTimeout: () => {
          if (phaseRef.current !== 'scanning') return;
          setError({ code: 'pendant_not_found' });
          setPhase('failed');
        },
      },
    );
  }, [setPhase]);

  // Ready for BLE: a real gold-dot press (or the simulator mock) starts the scan.
  useEffect(() => {
    return pendant().onEvent((e) => {
      if (e.type !== 'pairing_press') return;
      if (phaseRef.current !== 'ready' && phaseRef.current !== 'failed') return;
      scan();
    });
  }, [scan]);

  const pair = useCallback(
    async (p: FoundPendant) => {
      stopScan.current?.();
      stopScan.current = null;
      setError(null);
      setPhase('pairing');
      try {
        const householdId = useHousehold.getState().householdId;
        const device = useWearer.getState().device;
        if (!householdId || !device) throw new Error('Claim the pendant first (C2)');
        const t = pendant();
        await t.connect(p.id);
        const { challenge } = await getPairingChallenge(householdId, device.id);
        const signature = await t.signChallenge(challenge);
        const verified = await activatePendant(householdId, device.id, signature, p.id);
        await useWearer.getState().save({ device: verified, pendantId: p.id });
        setPhase('paired');
      } catch (e) {
        setError(e);
        setPhase('failed');
      }
    },
    [setPhase],
  );

  return { phase, found, error, scan, pair };
}
