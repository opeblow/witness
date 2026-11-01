# Deployment

This guide takes Witness from a fresh clone to a live deployment on the Portaldot V3 testnet.

## 1. Prerequisites

- Node.js 22 or newer.
- Testnet tPOT. Hackathon participants receive a first batch at the native address given at registration; otherwise ask in the [Portaldot Discord](https://discord.gg/portaldot).

```bash
npm install
npm run build -w @witness/contracts   # compiles WitnessRegistry
```

## 2. Create the sponsor key

```bash
npm run keys -w @witness/tools
```

This writes `.secrets/notary.env` (git-ignored) and prints two addresses:

- **Sponsor (native SS58)**: fund this address with tPOT. It pays for deployment and every capture.
- **Sponsor as seen by contracts**: the `submitter` address in registry anchors.

Back up the mnemonic in `.secrets/notary.env`. Anyone with it can spend the sponsor's funds.

## 3. Deploy the registry

```bash
npm run deploy:registry
```

The script deploys `WitnessRegistry` through pallet-revive's native `instantiateWithCode`, prints the address, block, extrinsic and total cost, and writes `deployments/portaldot-v3-testnet.json`. Commit that file: the web app and notary read the registry address from it.

## 4. Smoke-test against the live chain

```bash
npm run smoke -w @witness/tools
```

Creates a capture of a generated image, anchors it with the same atomic extrinsic the notary uses, then verifies the original (`authentic`), a re-encoded copy (`authentic`) and an edited copy (`altered`) straight from the chain. It prints the cost per capture.

## 5. Run the notary

```bash
npm run dev:notary            # development, reloads on change
npm run build && node services/notary/dist/main.js   # production
```

With Docker:

```bash
docker build -f services/notary/Dockerfile -t witness-notary .
docker run --env-file .secrets/notary.env -p 8787:8787 witness-notary
```

Set `ALLOWED_ORIGINS` to the web app's origin in production.

## 6. Build and host the web app

```bash
VITE_NOTARY_URL=https://your-notary.example.com npm run build -w @witness/web
```

The output in `apps/web/dist` is static. `.github/workflows/pages.yml` publishes it to GitHub Pages on every push to `main`; set the repository variable `VITE_NOTARY_URL` and enable Pages with "GitHub Actions" as the source.

## 7. Audit the deployment

```bash
npm run verify:live
```

A read-only check anyone can run without keys: registry code exists, recent anchors resolve to signed envelopes in their blocks, and every envelope passes all integrity checks. CI runs it on a schedule.
