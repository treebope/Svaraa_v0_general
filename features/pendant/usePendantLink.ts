import { useCallback, useEffect, useRef, useState } from 'react';
import { flags } from '@/config/flags';
import { pendant, type FoundPendant } from '@/services/pendant';
import { requestWearerPermission } from '@/services/permissions/wearerPermissions';
import { usePendantStatus } from './store';

const SCAN_MS = 15_000;

/**
 * Dev screen: scan, connect and disconnect a pendant directly, without the wearer set-up (claim and pairing).
 * Connecting is enough for the relay: the pendant sends its hello and audio starts flowing.
 */
export function usePendantLink() {
  const status = usePendantStatus();
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<FoundPendant[]>([]);
  const [error, setError] = useState<string>();
  const stopScan = useRef<(() => void) | null>(null);

  useEffect(() => () => stopScan.current?.(), []);

  const scan = useCallback(async () => {
    stopScan.current?.();
    setError(undefined);
    setFound([]);
    const permission = await requestWearerPermission('bluetooth');
    if (permission !== 'granted') {
      setError('bluetooth_permission');
      return;
    }
    setScanning(true);
    stopScan.current = pendant().scan(
      (p) => setFound((list) => (list.some((f) => f.id === p.id) ? list : [...list, p])),
      { timeoutMs: SCAN_MS, onTimeout: () => setScanning(false) },
    );
  }, []);

  const connect = useCallback(async (p: FoundPendant) => {
    stopScan.current?.();
    stopScan.current = null;
    setScanning(false);
    setError(undefined);
    try {
      await pendant().connect(p.id);
    } catch (e) {
      setError((e as { code?: string }).code ?? 'pendant_connect_failed');
    }
  }, []);

  const disconnect = useCallback(() => pendant().disconnect(), []);

  return { transport: flags.pendantTransport, status, scanning, found, error, scan, connect, disconnect };
}
