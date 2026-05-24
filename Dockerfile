FROM node:22-bookworm-slim AS build

WORKDIR /app
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}

COPY web/package*.json ./web/
WORKDIR /app/web
RUN npm install

WORKDIR /app
COPY result ./result
COPY web ./web
WORKDIR /app/web
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/c2e.sqlite

WORKDIR /app

COPY --from=build /app/web/package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/web/dist ./dist
COPY --from=build /app/web/generated ./generated

RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
