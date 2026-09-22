# notes-api — Docker, Explained Through a Real Backend Application

Companion repository for the Medium article:

📚 **[Docker Explained Through a Real Backend Application](https://medium.com/@shahadathhs/docker-explained-through-a-real-backend-application-4ee7a422dd38)**

A small Node.js + TypeScript notes API with a PostgreSQL database, built and shipped with Docker — step by step, from a naive **1.71 GB** image down to a **356 MB** production build.

> Every command output in the article was captured live from this app — including the failures. The `localhost` trap, the disappearing database, the 79% image size cut: all real.

## Quick start

```bash
docker compose up -d --build
```

The API waits for Postgres to pass its healthcheck, then starts:

```text
 Container notes-db-1 Started
 Container notes-db-1 Healthy
 Container notes-api-1 Started
```

Try it:

```bash
curl http://localhost:8080/health

curl -X POST http://localhost:8080/notes \
  -H 'Content-Type: application/json' \
  -d '{"title":"Learn Docker"}'

curl http://localhost:8080/notes
```

Tear it down (add `-v` to delete the data volume too):

```bash
docker compose down
```

## Repository contents

- **[`src/index.ts`](src/index.ts)** — the notes API: Express + `pg`, ~60 lines
- **[`Dockerfile`](Dockerfile)** — the naive first version from the article (builds to 1.71 GB)
- **[`Dockerfile.optimized`](Dockerfile.optimized)** — the multi-stage production build (356 MB)
- **[`compose.yaml`](compose.yaml)** — the full stack: API + Postgres, healthchecks, named volume, restart policy
- **[`.dockerignore`](.dockerignore)** — keeps `node_modules`, `.env`, and `.git` out of the build context
- **[`ARTICLE.md`](ARTICLE.md)** — the full article text
- **[`CHEATSHEET.md`](CHEATSHEET.md)** — Docker cheat sheet: every command with flags, options, and examples

## Reproduce the article's experiments

```bash
# build both image versions and compare sizes (article §8.5)
docker build -t notes-api:1.0 .
docker build -f Dockerfile.optimized -t notes-api:prod .
docker images notes-api

# inspect the layers that make up the naive image (§3.4)
docker history notes-api:1.0

# run the api alone and watch it fail — the localhost problem (§7.2)
docker run --rm notes-api:1.0
# failed to start: connect ECONNREFUSED 127.0.0.1:5432
```

## The mental model

```
Dockerfile ──build──▶ Image ──run──▶ Container
                        │               │
                     push/pull      logs · exec · stop
                        │               │
                     registry        volume ──▶ data survives

         images are immutable
         containers are disposable
         volumes persist
         networks connect
         environment variables configure
```

## Related

- 📝 **[Docker Explained Through a Real Backend Application](https://medium.com/@shahadathhs/docker-explained-through-a-real-backend-application-4ee7a422dd38)** — the article this repo accompanies
- 📋 **[CHEATSHEET.md](CHEATSHEET.md)** — the full Docker command reference, from beginner to expert
- 🌐 **[Useful Networking Commands for Deployment & Troubleshooting](https://medium.com/@shahadathhs/useful-networking-commands-for-deployment-troubleshooting-30b904c59657)** — the companion article for diagnosing DNS, ports, firewalls, and TLS from the command line

## Requirements

Docker — any recent version. No Node, no Postgres; the containers bring everything.

## License

[MIT](LICENSE)
