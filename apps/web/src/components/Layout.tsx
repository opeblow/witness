import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { NETWORK, REPOSITORY_URL } from '../lib/config';
import { Wordmark } from './Logo';
import './layout.css';

const NAV = [
  { to: '/capture', label: 'Capture' },
  { to: '/verify', label: 'Verify' },
  { to: '/ledger', label: 'Ledger' },
  { to: '/developers', label: 'Developers' },
];

export function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="page site-header-inner">
          <Link to="/" className="site-home" aria-label="Witness home">
            <Wordmark />
          </Link>
          <nav aria-label="Primary" className="site-nav">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className="site-nav-link">
                {item.label}
              </NavLink>
            ))}
          </nav>
          <span className="network-tag" title={`Connected to ${NETWORK.substrateRpc}`}>
            <span className="network-dot" aria-hidden="true" />
            Portaldot V3 testnet
          </span>
        </div>
      </header>
      <main id="main" className="site-main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="page site-footer-inner">
          <div className="stack" style={{ ['--stack' as string]: '12px' }}>
            <Wordmark />
            <p className="muted footer-note">
              Capture-time evidence for photographs, anchored on Portaldot V3. Open source under the
              Apache License 2.0.
            </p>
          </div>
          <nav aria-label="Footer" className="footer-links">
            <div className="stack" style={{ ['--stack' as string]: '8px' }}>
              <span className="label">Product</span>
              <Link to="/capture">Capture</Link>
              <Link to="/verify">Verify</Link>
              <Link to="/ledger">Ledger</Link>
            </div>
            <div className="stack" style={{ ['--stack' as string]: '8px' }}>
              <span className="label">Build</span>
              <Link to="/developers">Developers</Link>
              <a href={REPOSITORY_URL}>Source code</a>
              <a href={`${REPOSITORY_URL}/blob/main/docs/architecture.md`}>Architecture</a>
            </div>
            <div className="stack" style={{ ['--stack' as string]: '8px' }}>
              <span className="label">Trust</span>
              <a href={`${REPOSITORY_URL}/blob/main/docs/threat-model.md`}>Threat model</a>
              <a href={`${REPOSITORY_URL}/blob/main/PRIVACY.md`}>Privacy</a>
              <a href={`${REPOSITORY_URL}/blob/main/SECURITY.md`}>Security</a>
            </div>
          </nav>
        </div>
        <div className="page footer-base">
          <span className="label">Built for Portaldot Hacker House 2026</span>
          <span className="label">Testnet. Not for evidence of record yet.</span>
        </div>
      </footer>
    </div>
  );
}
