FROM node:22.23.4-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
RUN npm run build

# Optional container for serving the same static build; no application backend.
FROM node:22.23.4-bookworm-slim
WORKDIR /app
ENV PORT=10000 STATIC_HOST=0.0.0.0
COPY --from=frontend /app/dist ./dist
COPY scripts/serve-static.mjs ./scripts/serve-static.mjs
USER node
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "scripts/serve-static.mjs"]
