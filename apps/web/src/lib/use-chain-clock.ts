import { useEffect, useState } from 'react';
import { getApi } from './chain';

export interface ChainClock {
  readonly block: number | null;
  readonly error: string | null;
}

/** Subscribes to finalized heads: the clock every capture is stamped against. */
export function useChainClock(enabled = true): ChainClock {
  const [state, setState] = useState<ChainClock>({ block: null, error: null });
  useEffect(() => {
    if (!enabled) return;
    let unsubscribe: (() => void) | null = null;
    let live = true;
    getApi()
      .then((api) =>
        api.rpc.chain.subscribeFinalizedHeads((header) => {
          if (live) setState({ block: header.number.toNumber(), error: null });
        }),
      )
      .then((unsub) => {
        if (live) unsubscribe = unsub;
        else unsub();
      })
      .catch(() => {
        if (live) setState({ block: null, error: 'Cannot reach the Portaldot node.' });
      });
    return () => {
      live = false;
      unsubscribe?.();
    };
  }, [enabled]);
  return state;
}
