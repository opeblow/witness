import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { type Anchor, signerAddress } from '@witness/core';
import { getRegistry, isDeployed } from '../lib/chain';
import { DEPLOYMENT, NETWORK, blockLink } from '../lib/config';
import { formatNumber, shortHash, witnessId } from '../lib/format';
import { useChainClock } from '../lib/use-chain-clock';
import { NotDeployed } from './Capture';
import './app.css';

export function Ledger() {
  const [anchors, setAnchors] = useState<Anchor[] | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clock = useChainClock();

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const registry = await getRegistry();
        if (!registry) return;
        const [recent, total] = await Promise.all([
          registry.recent({ limit: 100 }),
          registry.anchorCount(),
        ]);
        if (live) {
          setAnchors(recent);
          setCount(total);
        }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : 'Could not read the registry.');
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const age = (block: number) => {
    if (clock.block === null) return '';
    const seconds = Math.max(0, (clock.block - block) * (NETWORK.blockTimeMs / 1000));
    if (seconds < 90) return `${Math.round(seconds)} s ago`;
    if (seconds < 5400) return `${Math.round(seconds / 60)} min ago`;
    if (seconds < 129_600) return `${Math.round(seconds / 3600)} h ago`;
    return `${Math.round(seconds / 86_400)} d ago`;
  };

  return (
    <div className="app-page page">
      <header className="app-head">
        <div>
          <p className="label">Ledger</p>
          <h1 className="h1">Every capture, in public.</h1>
          <p className="lede">
            Read live from WitnessRegistry on Portaldot. Ids and signatures are public; pictures are
            not, unless the capturer published a preview.
          </p>
        </div>
      </header>
      {!isDeployed() ? <NotDeployed /> : null}

      {isDeployed() ? (
        <div className="ledger-stats">
          <div>
            <span className="label">Captures anchored</span>
            <span className="ledger-stat">{count === null ? '-' : formatNumber(count)}</span>
          </div>
          <div>
            <span className="label">Registry</span>
            <span className="mono small break">{NETWORK.registry}</span>
          </div>
          <div>
            <span className="label">Deployed</span>
            <span className="mono small">
              {DEPLOYMENT ? (
                <a href={blockLink(DEPLOYMENT.deploymentBlock)} target="_blank" rel="noreferrer">
                  Block {formatNumber(DEPLOYMENT.deploymentBlock)}
                </a>
              ) : (
                '-'
              )}
            </span>
          </div>
        </div>
      ) : null}

      {error ? <p className="notice notice-bad">{error}</p> : null}
      {anchors && anchors.length === 0 ? (
        <p className="muted">No captures yet. Be the first.</p>
      ) : null}
      {anchors && anchors.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Witness id</th>
                <th scope="col">Block</th>
                <th scope="col">Age</th>
                <th scope="col">Signed by</th>
                <th scope="col">Fingerprint</th>
              </tr>
            </thead>
            <tbody>
              {anchors.map((a) => (
                <tr key={a.contentHash}>
                  <td>
                    <Link to={`/v/${a.contentHash}`} className="mono">
                      {witnessId(a.contentHash)}
                    </Link>
                  </td>
                  <td className="mono">
                    <a href={blockLink(a.blockNumber)} target="_blank" rel="noreferrer">
                      {formatNumber(a.blockNumber)}
                    </a>
                  </td>
                  <td className="muted">{age(a.blockNumber)}</td>
                  <td className="mono">
                    {a.signer ? shortHash(signerAddress(a.signer), 8, 6) : '-'}
                  </td>
                  <td className="mono muted">{a.dhash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
