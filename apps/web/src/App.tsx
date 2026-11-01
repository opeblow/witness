import { type ReactNode, Suspense, lazy } from 'react';
import { Link, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';

// The landing page loads eagerly; app pages load on demand with the chain libraries they need.
const Capture = lazy(() => import('./pages/Capture').then((m) => ({ default: m.Capture })));
const Verify = lazy(() => import('./pages/Verify').then((m) => ({ default: m.Verify })));
const Record = lazy(() => import('./pages/Record').then((m) => ({ default: m.Record })));
const Ledger = lazy(() => import('./pages/Ledger').then((m) => ({ default: m.Ledger })));
const Developers = lazy(() =>
  import('./pages/Developers').then((m) => ({ default: m.Developers })),
);

function Page({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="page app-page muted">Loading...</div>}>{children}</Suspense>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route
          path="capture"
          element={
            <Page>
              <Capture />
            </Page>
          }
        />
        <Route
          path="verify"
          element={
            <Page>
              <Verify />
            </Page>
          }
        />
        <Route
          path="v/:id"
          element={
            <Page>
              <Record />
            </Page>
          }
        />
        <Route
          path="ledger"
          element={
            <Page>
              <Ledger />
            </Page>
          }
        />
        <Route
          path="developers"
          element={
            <Page>
              <Developers />
            </Page>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function NotFound() {
  return (
    <div className="app-page page narrow">
      <p className="label">404</p>
      <h1 className="h1">Nothing was captured here.</h1>
      <p className="lede">
        <Link to="/">Back to Witness</Link>
      </p>
    </div>
  );
}
