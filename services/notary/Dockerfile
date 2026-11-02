# Build from the repository root:
#   docker build -f services/notary/Dockerfile -t witness-notary .
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/sdk/package.json packages/sdk/
COPY services/notary/package.json services/notary/
RUN npm ci --workspace @witness/core --workspace @witness/sdk --workspace @witness/notary --include-workspace-root=false --ignore-scripts
COPY packages/core packages/core
COPY packages/sdk packages/sdk
COPY services/notary services/notary
RUN npm run build -w @witness/core -w @witness/sdk -w @witness/notary \
 && npm prune --omit=dev --workspace @witness/core --workspace @witness/sdk --workspace @witness/notary

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/node_modules node_modules
# Copy whole workspace folders: npm nests some @polkadot packages in each
# workspace's own node_modules, which the root node_modules does not contain.
COPY --from=build /repo/packages/core packages/core
COPY --from=build /repo/packages/sdk packages/sdk
COPY --from=build /repo/services/notary services/notary
COPY deployments deployments
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:${NOTARY_PORT:-8787}/healthz || exit 1
CMD ["node", "services/notary/dist/main.js"]
