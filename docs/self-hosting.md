# Self-hosted Convex

[docker/convex/docker-compose.yml](../docker/convex/docker-compose.yml) runs the Convex backend and its administration dashboard. The Logi Next.js app and Discord bot run separately.

## Start a local instance

```bash
cd docker/convex
docker compose up -d
docker compose exec backend ./generate_admin_key.sh
```

The default backend endpoint is `http://127.0.0.1:3210`, the site proxy is on `3211`, and the Convex dashboard is on `6791`. Set the private root `.env.local` values using the generated administration key:

```dotenv
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210
CONVEX_SELF_HOSTED_ADMIN_KEY=your-generated-admin-key
```

From the repository root, `npx convex dev` pushes functions to the configured development backend. `npm run convex:deploy` deploys to the configured deployment. Set the same `INTERNAL_AUTH_SECRET` in Convex and the Logi runtimes.

## Storage and networking

The `data` Docker volume persists backend data. The Compose file accepts `POSTGRES_URL`, `MYSQL_URL`, `DATABASE_URL`, and S3 configuration through its environment. Back up persistent storage and private configuration as part of operating the instance.

`PORT`, `SITE_PROXY_PORT`, and `DASHBOARD_PORT` select host ports. The checked-in Compose configuration publishes them on all interfaces; use an override to bind private services to loopback when a reverse proxy handles public traffic. Configure reachable origins and TLS for a hosted install.

## Retention and memory

`DOCUMENT_RETENTION_DELAY` controls retention of superseded document versions and defaults to `172800` seconds in this Compose file. This is separate from Logi's application-level game-history retention.

The checked-in defaults include `MAX_ISOLATE_WORKERS=16`, `ISOLATE_IDLE_TIMEOUT_SECONDS=600`, `ISOLATE_MAX_LIFETIME_SECONDS=3600`, `UDF_CACHE_MAX_SIZE=104857600`, and `INDEX_CACHE_SIZE=536870912`. Concurrent query, mutation, and action limits default to 16. The Compose file includes a commented container memory-limit example.

Container memory includes backend heaps, caches, and filesystem page cache. Inspect the backend's cgroup memory statistics to distinguish anonymous memory from file cache when investigating resource use. Size worker counts, caches, storage, and container limits for the host and workload.

See [architecture](../ARCHITECTURE.md#convex-hot-paths) for Logi's persistence and polling behavior. Upstream reference links: [Convex self-hosting](https://docs.convex.dev/self-hosting) and [backend configuration](https://github.com/get-convex/convex-backend/tree/main/self-hosted).

### Daily team catalogue refresh

Convex schedules Wardogs League and HeLO catalogue imports every 24 hours. Set `SITE_URL` in the Convex deployment to the reachable dashboard origin and use the same `INTERNAL_AUTH_SECRET` in both runtimes. The authenticated internal refresh route runs image decoding in the dashboard Node runtime and stores imported GIF logos as static PNGs. Manual catalogue imports use the same workflow.
