# notes-api — Docker, explained through a real backend

This is the companion repository for the Medium article
**[Docker Explained Through a Real Backend Application](https://medium.com/@shahadathhs/)**.
The full article text is also in this repo: [`ARTICLE.md`](ARTICLE.md).

A small Node.js + TypeScript notes API with a PostgreSQL database, built and shipped with Docker —
step by step, from a naive 1.71 GB image down to a 356 MB production build.

> The article walks through every file in this repo in the order you'd actually write them.
> This README is the short version. The article is the full story.

## What's inside

| File | Purpose |
|---|---|
| `src/index.ts` | The notes API — Express + `pg`, ~60 lines |
| `Dockerfile` | The naive first version (builds to 1.71 GB) |
| `Dockerfile.optimized` | Multi-stage production build (356 MB) |
| `compose.yaml` | The full stack: API + Postgres, network, volume, healthchecks |
| `.dockerignore` | Keeps `node_modules`, `.env`, and `.git` out of the build context |
| `ARTICLE.md` | The full article text |

## Quick start

```bash
docker compose up -d --build
```

The API waits for Postgres to pass its healthcheck, then starts:

```text
[+] Running 4/4
 ✔ Container notes-db-1   Healthy
 ✔ Container notes-api-1  Started
```

Try it:

```bash
curl http://localhost:8080/health
# {"status":"ok","uptime":4.813545335}

curl -X POST http://localhost:8080/notes \
  -H 'Content-Type: application/json' \
  -d '{"title":"Learn Docker"}'

curl http://localhost:8080/notes
```

Tear it all down (add `-v` to delete the data volume too):

```bash
docker compose down
```

## Commands from the article

Everything demonstrated in the article can be re-run from this repo. A few highlights:

```bash
# build both image versions and compare sizes (§8.5)
docker build -t notes-api:1.0 .                           # naive — 1.71 GB
docker build -f Dockerfile.optimized -t notes-api:prod .  # multi-stage — 356 MB
docker images notes-api

# inspect the layers that make up the naive image (§3.4)
docker history notes-api:1.0

# run the api alone and watch it fail — the localhost problem (§7.2)
docker run --rm --name notes-api notes-api:1.0
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

## Requirements

- Docker (any recent version)

That's it. No Node, no Postgres — the containers bring everything.

## License

MIT
