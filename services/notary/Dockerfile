# Build from the repository root:
#   docker build -f services/notary/Dockerfile -t witness-notary .
FROM node:26-alpine AS build
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

FROM node:26-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/core/package.json packages/core/package.json
COPY --from=build /repo/packages/core/dist packages/core/dist
COPY --from=build /repo/packages/sdk/package.json packages/sdk/package.json
COPY --from=build /repo/packages/sdk/dist packages/sdk/dist
COPY --from=build /repo/services/notary/package.json services/notary/package.json
COPY --from=build /repo/services/notary/dist services/notary/dist
COPY deployments deployments
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1
CMD ["node", "services/notary/dist/main.js"]
