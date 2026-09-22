# Docker Explained Through a Real Backend Application

#### A practical guide to Docker images, containers, Dockerfiles, Compose, networking, volumes, and production builds — with real output from a real app, not diagrams-on-whiteboards.

When you run your backend on your own machine, everything feels simple:

```bash
npm run dev
```

Your app talks to a database on `localhost`, you edit a file, it reloads. Life is good.

Then you try to run it somewhere else — a teammate's laptop, a CI server, a VPS — and suddenly:

- "It works on my machine"
- The database version is different
- The Node version is different
- The app can't reach Postgres
- Nobody remembers which env vars are needed

You can fix these one at a time. Or you can package the whole thing — runtime, dependencies, code, config — into one portable unit.

That unit is a **container**, and the tool that builds and runs it is **Docker**.

This article teaches Docker the way you'll actually use it: by taking a small real backend (a Node.js + TypeScript API with a Postgres database) and dockerizing it step by step — including the failures, because the failures are where the learning happens.

> **Note:** Every command output in this article is real, captured while running the app on Ubuntu. You can follow along with any Linux machine or Mac with Docker installed.

## 1. Introduction

### 1.1 Why Docker?

Docker solves one specific problem: **environment drift**.

Your app depends on:

- A Node version
- A set of npm packages
- A Postgres version
- Environment variables
- A network setup

Install those differently on two machines and you get two different behaviors. Docker freezes all of it into an **image** — a sealed, versioned snapshot. Run the image anywhere Docker exists, and it behaves identically.

The payoff:

- **Onboarding**: a new dev runs one command, not a 20-step wiki page
- **Parity**: what you test is what you deploy
- **Isolation**: each app gets its own runtime, ports, and dependencies
- **Clean removal**: delete the container, and your machine is exactly as it was

### 1.2 What This Article Covers

We'll build and run a real application in Docker, in the order you'd actually do it:

1. Understand what images and containers actually are
2. Write a Dockerfile and build an image
3. Run containers, pass config, read logs
4. Persist data with volumes
5. Run the full stack with Docker Compose
6. Understand container networking (and the `localhost` trap)
7. Optimize the build and shrink the image
8. Harden it for production
9. Troubleshoot the failures you'll actually hit

Along the way we'll watch the app fail for real reasons — connection refused, disappearing data, bloated images — and fix each one.

### 1.3 The Application We'll Use

A small **notes API**:

- **Node.js 22 + TypeScript + Express** — three routes: `GET /health`, `GET /notes`, `POST /notes`
- **PostgreSQL 17** — one table, `notes`
- On startup, the API connects to Postgres and creates its table

The whole app is ~60 lines. That's the point — the app isn't the interesting part. **Docker is.**

```typescript
import express from "express";
import { Pool } from "pg";

const app = express();
app.use(express.json());

const port = Number(process.env.PORT) || 3000;

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
  database: process.env.PGDATABASE || "notes",
});

// ... routes: GET /health, GET /notes, POST /notes

init()
  .then(() => {
    app.listen(port, () => {
      console.log(`notes-api listening on port ${port}`);
      console.log(`connected to postgres at ${process.env.PGHOST || "localhost"}:${process.env.PGPORT || 5432}`);
    });
  })
  .catch((err) => {
    console.error("failed to start:", err.message);
    process.exit(1);
  });
```

Two details matter for everything that follows:

- The database host comes from the **`PGHOST` environment variable**, defaulting to `localhost`
- If the database is unreachable, the process **exits with an error** — you'll see exactly that later

## 2. Understanding Docker

### 2.1 What Is Docker?

Docker is a tool that **builds, ships, and runs containers**.

A container is a normal Linux process — not a VM — with two tricks applied:

- **Namespaces**: the process gets its own view of the network, filesystem, and process tree
- **Control groups (cgroups)**: limits on how much CPU and memory it can use

The container believes it's alone on the machine. It has its own `localhost`, its own filesystem, its own environment variables.

### 2.2 Docker Images

An **image** is a read-only, frozen snapshot of everything the app needs to run: the filesystem, the dependencies, the command to start.

Images are built from a **Dockerfile** and stored in a registry (Docker Hub by default) where others can pull them:

```bash
docker pull postgres:17
```

That downloads a ready-made Postgres 17 image — you never install Postgres again.

### 2.3 Docker Containers

A **container** is a running instance of an image.

One image, many containers — like one program and many processes. Each container has:

- Its own filesystem (a writable layer over the read-only image)
- Its own network identity
- Its own environment variables
- Its own lifecycle: created → running → stopped → removed

### 2.4 Images vs Containers

The relationship is **class vs instance**, or if you prefer, **recipe vs dish**. Image on the left, container on the right:

- Read-only template → running (or stopped) process
- Built once, stored on disk → created from an image
- Immutable → has state, logs, a writable layer
- `docker build`, `docker pull` → `docker run`, `docker ps`

Delete a container and the image remains. Delete the image while containers run from it, and Docker refuses.

### 2.5 Containers vs Virtual Machines

A VM virtualizes **hardware** — a whole operating system, its own kernel, gigabytes of disk.

A container virtualizes only the **environment** — it shares the host's kernel and runs as an isolated process:

```
┌─────────────────────┐   ┌─────────────────────┐
│       VM            │   │     Containers      │
│ ┌─────┐ ┌─────┐    │   │ ┌────┐ ┌────┐ ┌────┐│
│ │ App │ │ App │    │   │ │App │ │App │ │App ││
│ ├─────┤ ├─────┤    │   │ ├────┤ ├────┤ ├────┤│
│ │ Libs│ │ Libs│    │   │ │Libs│ │Libs│ │Libs││
│ ├─────┤ ├─────┤    │   │ ├────┤ ├────┤ ├────┤│
│ │ OS  │ │ OS  │    │   │ └────┴────┴─┬────┘│
│ └──┬──┘ └──┬──┘    │   └────────────┼─────┘│
│ ┌──┴───────┴──┐    │   ┌────────────┼─────┐│
│ │  Hypervisor │    │   │ Container runtime │
│ └─────────────┘    │   └────────┬─────────┘│
└────────┬────────────┘   ┌───────┴──────────┐
         └────────────────│    Host OS       │
                          └──────────────────┘
```

That's why containers start in milliseconds and measure in megabytes, while VMs start in tens of seconds and measure in gigabytes.

## 3. Creating a Docker Image

### 3.1 Introducing the Dockerfile

A **Dockerfile** is a build recipe: a list of instructions Docker executes top-to-bottom to produce an image.

Here's the first version for the notes API — deliberately naive, the way everyone writes their first one:

```dockerfile
FROM node:22

WORKDIR /app

COPY . .

RUN npm install && npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Six instructions, and the app is packaged.

### 3.2 Dockerfile Instructions

The instructions you'll use 95% of the time:

- **`FROM`** — the base image to start from
- **`WORKDIR`** — sets the working directory inside the image
- **`COPY`** — copies files from your machine into the image
- **`RUN`** — executes a command **at build time**
- **`ENV`** — sets environment variables inside the image
- **`EXPOSE`** — documents which port the app listens on
- **`CMD`** — the command to run **when a container starts**
- **`ENTRYPOINT`** — the fixed executable; `CMD` becomes its arguments

The distinction that trips people up: **`RUN` happens at build time, `CMD` happens every time a container starts.** `RUN npm install` bakes dependencies into the image. `CMD ["npm", "start"]` runs on every container start.

### 3.3 Building an Image

From the project directory:

```bash
docker build -t notes-api:1.0 .
```

- `-t notes-api:1.0` — name and tag for the image
- `.` — the **build context**: the directory Docker can see

Docker executes each instruction as a step:

```text
#1 [internal] load build definition from Dockerfile
#2 [internal] load metadata for docker.io/library/node:22
#3 [internal] load .dockerignore
#4 [1/4] FROM docker.io/library/node:22@sha256:dd5847a...
#5 [internal] load build context
#6 [2/4] WORKDIR /app
#7 [3/4] COPY . .
#8 [4/4] RUN npm install && npm run build
```

And the result:

```text
REPOSITORY   TAG       SIZE
notes-api    1.0       1.71GB
```

**1.71GB.** For a 60-line API. Hold that thought — we fix it in section 8.

### 3.4 Understanding Image Layers

Each Dockerfile instruction creates a **layer** — a snapshot of the filesystem diff from the previous step. Inspect them:

```bash
docker history notes-api:1.0
```

```text
CREATED BY                                      SIZE
CMD ["npm" "start"]                             0B
EXPOSE [3000/tcp]                               0B
RUN /bin/sh -c npm install && npm run build …   79.8MB
COPY . . # buildkit                             61.4kB
WORKDIR /app                                    8.19kB
CMD ["node"]                                    0B
ENTRYPOINT ["docker-entrypoint.sh"]             0B
```

Read it bottom-up, like an onion:

- The bottom layers come from `node:22` — Node itself, the base OS files (that's where most of the 1.71GB lives)
- `WORKDIR` adds a directory: 8KB
- `COPY . .` adds your source: 61KB
- `npm install` adds dependencies: 80MB

Layers are **cached and shared**. Two images built from `node:22` share all the Node layers on disk. Rebuild after editing source code, and Docker only re-runs steps from `COPY` onward — everything before it is cache hits. This is the single most important fact about Docker builds, and section 8 exploits it fully.

### 3.5 Docker Build Context

That `.` in `docker build -t notes-api:1.0 .` isn't cosmetic. It's the **build context** — the set of files Docker is allowed to `COPY` from.

Docker tars up the entire directory and sends it to the builder. If your project contains `node_modules`, `.git`, build artifacts — all of it ships to Docker on every build, even if the Dockerfile never copies it.

This bites in two ways: slow builds, and worse — a host `node_modules` copied into the image can **break the build**. It happened while writing this article:

```text
#8 126.3 npm error Cannot read properties of null (reading 'matches')
#8 ERROR: process "/bin/sh -c npm install" did not complete successfully: exit code: 1
```

The host had pnpm-installed `node_modules` with symlinks; `COPY . .` dragged them into the image; `npm install` choked on them. The fix is `.dockerignore` — section 8.3.

## 4. Running Containers

### 4.1 Starting a Container

```bash
docker run -d --name notes-api -p 8080:3000 notes-api:1.0
```

- `-d` — detached, in the background
- `--name notes-api` — a name you can refer to (otherwise Docker generates one)
- `-p 8080:3000` — publish container port 3000 as host port 8080
- `notes-api:1.0` — the image to run

What happened when I ran it:

```bash
docker ps -a --filter name=notes-api
```

```text
NAMES       STATUS                     PORTS
notes-api   Exited (1) 2 seconds ago
```

**It exited immediately.** The app ran, tried to connect to Postgres, failed, and exited — exactly as the code says. Let's read why.

### 4.2 Publishing Ports

First, the flag itself, because it's a common confusion point:

```text
3000/tcp -> 0.0.0.0:8080
```

`-p 8080:3000` means: host port **8080** forwards to container port **3000**. Left of the colon is your machine; right is the container.

Two rules:

1. Nothing outside the container can reach port 3000 unless you publish it
2. Inside the container, the app **always** listens on 3000 — publishing never changes the app, only the doorway

Check mappings any time:

```bash
docker port notes-api
```

### 4.3 Environment Variables

Containers must be configured from outside — the image is the same in dev, staging, and production; only the variables differ.

Pass them at run time with `-e`:

```bash
docker run -d --name notes-api \
  -p 8080:3000 \
  -e PGHOST=notes-db \
  -e PGUSER=postgres \
  -e PGPASSWORD=postgres \
  -e PGDATABASE=notes \
  notes-api:1.0
```

Verify from inside:

```bash
docker exec notes-api env | grep PG
```

```text
PGHOST=notes-db
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=notes
```

The image contains no secrets and no environment-specific values — only the code. Everything environment-specific arrives at `docker run`.

### 4.4 Container Logs

Containers write to **stdout/stderr**; Docker captures it:

```bash
docker logs notes-api
docker logs -f notes-api        # follow, like tail -f
docker logs --tail 100 notes-api
```

From the failed run earlier:

```text
> notes-api@1.0.0 start
> node dist/index.js

failed to start: connect ECONNREFUSED 127.0.0.1:5432
```

That single line explains everything: the app looked for Postgres on `localhost:5432` — inside its own container — and nothing was there. We fix this properly in section 7.

> **Note:** An app that logs to files inside the container hides those files from `docker logs`. Log to stdout — always.

### 4.5 Executing Commands Inside a Container

`docker exec` runs a command inside a running container:

```bash
docker exec notes-api ls /app
```

```text
Dockerfile
dist
node_modules
package-lock.json
package.json
pnpm-lock.yaml
src
tsconfig.json
```

Or get a full shell:

```bash
docker exec -it notes-api sh
```

`-it` = interactive + TTY. This is how you debug a container as if you'd SSH'd into it — except there's no SSH server, no extra setup, nothing to install.

### 4.6 Container Lifecycle

A container moves through states:

```
created ──▶ running ──▶ paused
   │           │
   │           ▼
   │        exited ──▶ restarting
   │           │
   └───────────┴──▶ removed
```

The commands that drive it:

```bash
docker stop notes-api     # SIGTERM, then SIGKILL after 10s
docker start notes-api    # run an existing (stopped) container again
docker restart notes-api
docker rm notes-api       # remove a stopped container
docker rm -f notes-api    # stop + remove in one step
docker run --rm ...       # auto-remove when it exits
```

`stop` vs `rm` matters: **stop** halts the process but keeps the container — its writable layer, logs, and config survive, and `start` revives it. **rm** deletes it permanently. `docker ps` shows running containers; `docker ps -a` shows all, including dead ones — the first place to look when something "disappeared."

## 5. Persistent Data

### 5.1 The Container Filesystem

A container's filesystem is a writable layer stacked on the image's read-only layers. Write a file, and it lives in the writable layer. Kill the container, and the layer dies with it.

### 5.2 Why Containers Are Disposable

Here's the demo. Postgres was running with data in it:

```text
 id |    title
----+--------------
  1 | Learn Docker
  2 | Ship it
(2 rows)
```

Then:

```bash
docker rm -f notes-db
```

Recreate it fresh — same image, same flags:

```text
ERROR:  relation "notes" does not exist
```

**Everything is gone.** Not corrupted — gone. The table, the rows, all of it lived in the destroyed container's writable layer.

This is by design. Containers are cattle, not pets: you replace them freely, scale them up, delete them on every deploy. That only works if durable data lives **outside** the container.

### 5.3 Docker Volumes

A **volume** is Docker-managed storage that outlives any container. Create one and mount it at the path where Postgres keeps data:

```bash
docker volume create notes-data

docker run -d --name notes-db \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=notes \
  -v notes-data:/var/lib/postgresql/data \
  postgres:17
```

`-v notes-data:/var/lib/postgresql/data` — volume on the left, path **inside the container** on the right. Postgres doesn't know or care that it's writing to a volume.

### 5.4 Named Volumes

Now the same destruction test. Seed two rows, destroy the container, recreate it with the same volume:

```text
 id |       title
----+-------------------
  1 | Volumes persist
  2 | Containers do not
(2 rows)
```

The data survived. The container was disposable; the volume wasn't.

Where does it physically live?

```bash
docker volume inspect notes-data --format '{{.Mountpoint}}'
```

```text
/var/lib/docker/volumes/notes-data/_data
```

Docker picks and manages the location — that's the point. You never touch it directly; you create, mount, back up, and delete volumes through Docker:

```bash
docker volume ls
docker volume rm notes-data
docker volume prune          # delete ALL unused volumes (careful)
```

### 5.5 Bind Mounts

A **bind mount** maps a host directory into the container, by exact path:

```bash
docker run -v /home/you/notes-api:/app notes-api:1.0
```

Unlike a volume, **you** own the location. The container reads and writes your actual files, live — change a file on the host, the container sees it instantly.

### 5.6 Volumes vs Bind Mounts

Two dimensions, side by side — named volume on the left, bind mount on the right:

- **Location:** Docker-managed (`/var/lib/docker/volumes/...`) → any host path you choose
- **Portable:** yes — works anywhere Docker runs → no — depends on host paths
- **Performance:** good → slower on macOS/Windows
- **Best for:** databases, app data → live source code in development

The rule of thumb: **volumes for data you want to keep, bind mounts for code you're actively editing.** In production you'll almost exclusively use volumes.

## 6. Running Multiple Containers

### 6.1 The Multi-Container Application

Our full stack is two containers — API and Postgres — on a shared network, with the database's data on a volume. Doing that by hand:

```bash
docker network create notes-net
docker volume create notes-data
docker run -d --name notes-db ... postgres:17
docker run -d --name notes-api --network notes-net -e PGHOST=notes-db ... notes-api:1.0
```

Four commands, five flags each, in the right order. It doesn't scale to five services, and it doesn't survive a reboot.

### 6.2 Why Docker Compose?

**Docker Compose** declares the whole stack in one file and manages it as a unit:

- One file describing every service, network, and volume
- One command to start, stop, or destroy everything
- Correct startup order and health-gated dependencies
- The file is version-controlled documentation of your infrastructure

### 6.3 The Compose File

`compose.yaml` for our stack:

```yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: notes
    volumes:
      - notes-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d notes"]
      interval: 5s
      timeout: 3s
      retries: 5

  api:
    build: .
    ports:
      - "8080:3000"
    environment:
      PGHOST: db
      PGUSER: postgres
      PGPASSWORD: postgres
      PGDATABASE: notes
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

volumes:
  notes-data:
```

Notice what's *not* there: network definitions. Compose creates its own network automatically, and every service can reach every other **by service name**.

### 6.4 Services

Each key under `services:` is one container. Two kinds:

- `db` uses a ready-made **image**
- `api` is **built** from the local Dockerfile (`build: .`)

Everything you'd pass to `docker run` — ports, environment, volumes, restart policy — has a direct equivalent in the service definition. Compose tags names automatically too: your containers become `notes-api-1` and `notes-db-1`.

The `healthcheck` on `db` runs `pg_isready` every 5 seconds — that's what makes `depends_on: condition: service_healthy` meaningful: the API doesn't start until Postgres is *actually ready to accept connections*, not merely started.

### 6.5 Networks

Compose puts every service on a shared network it creates for the project. Inside that network:

- The API reaches the database at hostname `db` — no IPs, no flags
- Nothing is published to the host unless you say so — only `api` has a `ports:` entry, so `db` stays private

### 6.6 Volumes

Top-level `volumes:` declares named volumes; a service mounts them under the same key:

```yaml
volumes:
  notes-data:
```

Same persistence semantics as section 5 — destroy the stack, bring it back, the notes are still there.

### 6.7 Managing the Application with Compose

One command replaces the four-step manual setup:

```bash
docker compose up -d --build
```

```text
 Container notes-db-1 Starting
 Container notes-db-1 Started
 Container notes-db-1 Waiting
 Container notes-db-1 Healthy
 Container notes-api-1 Starting
 Container notes-api-1 Started
```

Read it closely — that's the healthcheck working: the API **waited** for `Healthy` before starting.

Status across the whole stack:

```bash
docker compose ps
```

```text
NAME          STATUS                    PORTS
notes-api-1   Up 5 seconds              0.0.0.0:8080->3000/tcp, [::]:8080->3000/tcp
notes-db-1    Up 11 seconds (healthy)   5432/tcp
```

And the proof:

```bash
curl http://localhost:8080/health
```

```json
{"status":"ok","uptime":4.813545335}
```

The rest of the lifecycle:

```bash
docker compose logs -f          # all services, streaming
docker compose logs -f api      # one service
docker compose restart api
docker compose stop             # stop everything, keep containers
docker compose down             # stop and remove containers + network
docker compose down -v          # ... and delete volumes (destroys data!)
```

## 7. Docker Networking

### 7.1 How Container Networking Works

Every container attaches to a network and gets its own network interface and IP. On the default `bridge` network there's no built-in name resolution. But on a **user-defined network**, Docker runs embedded DNS — every container name resolves automatically.

### 7.2 The `localhost` Problem

This is the single most common Docker beginner failure, so let's watch it happen.

Run the API. It exits instantly:

```text
failed to start: connect ECONNREFUSED 127.0.0.1:5432
```

"Postgres isn't running," you think — so you start Postgres. Run the API again:

```text
failed to start: connect ECONNREFUSED 127.0.0.1:5432
```

**Still fails.** Both containers are running. What's going on?

`localhost` inside a container means **that container** — not your machine, not other containers. The API's `localhost` has no Postgres on it, no matter what runs elsewhere. Two containers, two separate `localhost`s:

```
┌─── your machine ──────────────────────────────┐
│                                               │
│  ┌─ notes-api ─────────┐   ┌─ notes-db ────┐ │
│  │  localhost = itself │   │ localhost =   │ │
│  │      ❌ no db       │   │    itself     │ │
│  └─────────────────────┘   └───────────────┘ │
│                                               │
└───────────────────────────────────────────────┘
```

### 7.3 Container-to-Container Communication

The fix has two parts. First, a shared network so the containers can reach each other:

```bash
docker network create notes-net
docker network connect notes-net notes-db
```

Second — and this is the half people forget — point the app at the database **by name**:

```bash
docker run -d --name notes-api \
  --network notes-net \
  -e PGHOST=notes-db \
  ...
```

Result:

```text
notes-api listening on port 3000
connected to postgres at notes-db:5432
```

### 7.4 Service Names

Why does `PGHOST=notes-db` work? Docker's embedded DNS resolves container names **on user-defined networks**:

```bash
docker exec notes-api getent hosts notes-db
```

```text
172.23.0.2      notes-db
```

No IPs to manage — they change on every restart. Names are the stable identifier. In Compose, the service name plays this role automatically — that's why the compose file says `PGHOST: db`.

> **Note:** Name resolution works on user-defined networks only, not on the default `bridge`. If names don't resolve, that's the first thing to check.

### 7.5 Container Ports vs Host Ports

Two different worlds:

- **Container port**: where the app listens *inside* the container (our API: 3000)
- **Host port**: where *your machine* reaches it (we published 8080)

```text
your machine          container
    :8080  ─────────▶  :3000
```

Inside the network, containers talk to each other on **container ports** — the API connects to `notes-db:5432`, not to any published port. Publishing exists only for the outside world. That's why `notes-db` in compose has no `ports:` at all — the database needs no host doorway.

### 7.6 Common Networking Problems

A quick map — details in section 10:

- `ECONNREFUSED 127.0.0.1` from your app → you're using `localhost` to reach another container. Use the service name.
- Name doesn't resolve → containers aren't on the same user-defined network.
- Works inside the network, fails from your machine → port not published (`-p` missing).
- `port is already allocated` → the host port is taken; pick another.
- Works locally, fails from another machine → app listening on `127.0.0.1` inside the container instead of `0.0.0.0`.

## 8. Optimizing Docker Builds

Our image is 1.71GB for a 60-line API. Let's fix that, and the build speed along with it.

### 8.1 Docker Build Cache

Recall the layer onion: each instruction is a layer, and Docker caches them. On rebuild, Docker compares each instruction — starting from the top — with the cache:

- Instruction unchanged **and** its inputs unchanged → cache hit, layer reused instantly
- Anything changed → **that layer and everything below it rebuilds**

The naive Dockerfile:

```dockerfile
COPY . .
RUN npm install && npm run build
```

Edit one line of source → `COPY . .` changes → `npm install` reruns. Every code change reinstalls every dependency. Backwards.

The fix: copy only what `npm install` needs *first*, then the source:

```dockerfile
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
```

Now editing source invalidates only the last two layers — dependencies come from cache in seconds. **Order instructions from least-volatile to most-volatile**: base image → system packages → dependencies → source code.

### 8.2 Choosing a Base Image

The default `node:22` is built on a full Debian install — compilers, docs, package managers — none of which a runtime needs. Compare the family:

The family, from fat to thin:

- **`node:22`** — full Debian. Maximum compatibility, ~1 GB of stuff your runtime never asked for
- **`node:22-slim`** — Debian minus the fat. The production default
- **`node:22-alpine`** — Alpine Linux with musl. Smallest, occasional glibc quirks with native modules

For most production APIs, `node:22-slim` is the sweet spot — dramatically smaller than full, with none of Alpine's native-module edge cases.

### 8.3 `.dockerignore`

A `.dockerignore` in the build context root excludes paths from being sent to the builder — the Docker analog of `.gitignore`:

```
node_modules
dist
.git
.env
*.md
Dockerfile
compose.yaml
.dockerignore
```

Three wins:

1. **Faster builds** — less context to tar and ship on every build
2. **Correct builds** — the pnpm `node_modules` failure from section 3.5 disappears; fresh `npm install` inside the image
3. **Safer images** — `.env` secrets and `.git` history never enter the image

### 8.4 Optimizing Dockerfile Layers

Applying everything so far, plus one more idea — **multi-stage builds** (details in section 9.2):

```dockerfile
# ---- build stage ----
FROM node:22 AS build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ---- production stage ----
FROM node:22-slim AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm install --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

EXPOSE 3000

USER node

CMD ["node", "dist/index.js"]
```

Note what production copies from the build stage: **only `dist`**. TypeScript, `src/`, and dev dependencies simply don't exist in the final image.

### 8.5 Reducing Image Size

The before and after, from the real builds in this article:

```text
REPOSITORY   TAG       SIZE
notes-api    1.0       1.71GB     ← naive
notes-api    prod      356MB      ← multi-stage + slim
```

**1.71GB → 356MB — 79% smaller.** What changed:

- `node:22-slim` instead of `node:22`
- No source, no TypeScript, no dev dependencies in the final image
- `npm cache clean --force` so the layer doesn't carry npm's cache
- Distroless or Alpine could go smaller still — measure with `docker images` and `docker history` and decide

Smaller images aren't vanity: they pull faster on every deploy, scan faster, and shrink your attack surface.

## 9. Docker for Production

### 9.1 Development vs Production

Same stack, two very different jobs — development on the left, production on the right:

- **Source:** bind-mounted live code → baked into the image
- **Dependencies:** everything, plus watchers → production-only
- **Image:** big, fast to iterate → small, locked down
- **Config:** `.env` files → secrets manager / inject at run
- **Restart:** you restart manually → automatic

The image you ship should contain **only what running the app requires**. Everything else is surface area and weight.

### 9.2 Multi-Stage Builds

A multi-stage build uses multiple `FROM` lines. Each stage is a full build environment; the final image is **only the last stage** plus what you explicitly `COPY --from=` into it.

```dockerfile
FROM node:22 AS build
# compilers, dev deps, TypeScript — full toolkit

FROM node:22-slim AS production
COPY --from=build /app/dist ./dist
# runtime only
```

Build tools exist during the build, then vanish from the result. This one pattern gave us most of the 79% size cut.

### 9.3 Production Dependencies

```dockerfile
RUN npm install --omit=dev && npm cache clean --force
```

- `--omit=dev` — skip test frameworks, type checkers, watchers
- `npm cache clean --force` — the layer otherwise archives the download cache forever

One layer, `&&`-chained: two commands would create two layers, the first carrying the cache the second deletes.

### 9.4 Environment Configuration

Production config arrives the same way as section 4.3 — environment variables — but never via committed files:

```yaml
environment:
  PGHOST: db
  PGDATABASE: notes
```

Rules that hold up in practice:

- **No secrets in images.** Anything baked into an image is readable by anyone with the image.
- **No `.env` in git.** `.dockerignore` and `.gitignore` both exclude it.
- Same image, every environment — only variables differ. That's the parity that makes Docker worth it.

### 9.5 Container Health

A process being *running* doesn't mean it's *working* — ours crashed on a bad DB connection while still "Up" for a moment. Declare what healthy means:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres -d notes"]
  interval: 5s
  timeout: 3s
  retries: 5
```

For the API, point at a real endpoint:

```yaml
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://localhost:3000/health || exit 1"]
  interval: 30s
  timeout: 5s
  retries: 3
```

Now `depends_on: condition: service_healthy` actually gates startup on readiness, orchestrators can restart the sick, and `docker ps` shows `(healthy)` next to truth, not hope.

### 9.6 Logging and Restart Policies

Logs: stdout only — Docker collects, rotates, and ships them. A log driver or collector then centralizes them. If it's not on stdout, it's invisible.

Restarts: containers die — OOM kills, crashes, host reboots. Let Docker bring them back:

```yaml
restart: unless-stopped
```

Three policies:

- `no` — default; dead stays dead
- `always` — always restart, even after reboot, even if it was cleanly stopped (until you `docker stop`)
- `unless-stopped` — like `always`, but respects a manual stop

For most services: `unless-stopped`.

## 10. Troubleshooting Docker

Six failures you will actually hit. All of them happened in this article.

### 10.1 Container Won't Start

Symptom: it appears in `docker ps -a` as `Exited (1)` immediately.

```bash
docker ps -a
docker logs notes-api
```

```text
failed to start: connect ECONNREFUSED 127.0.0.1:5432
```

The logs almost always contain the answer. Ours did: the app looked for Postgres on its own `localhost`.

### 10.2 Connection Refused

`curl` from your machine:

```text
curl: (7) Failed to connect to localhost:8080
```

Work the chain — is the container up? Is the app listening inside it? Is the port published?

```bash
docker ps --filter name=notes-api
docker port notes-api
docker exec notes-api wget -qO- http://localhost:3000/health
```

- Not up → read the logs (10.1)
- Up, no mapping → add `-p 8080:3000`
- Works inside, fails outside → the app listens on `127.0.0.1` instead of `0.0.0.0` — Express's `app.listen(port)` default is fine; explicit `127.0.0.1` is not

### 10.3 Application Can't Reach the Database

The canonical one — `ECONNREFUSED 127.0.0.1:5432` from section 7.2. Checklist:

1. Same user-defined network (or same compose project)?
2. Using the **service/container name**, not `localhost` or an IP?
3. Connecting on the **container port** (5432), not a host-published port?
4. Database actually ready — healthcheck + `depends_on: service_healthy`?

### 10.4 Changes Aren't Appearing

You edited code; the container still runs old behavior.

Images are immutable — rebuilding is the only way in:

```bash
docker compose up -d --build
```

If you skipped `--build`, Compose happily reused the stale image. Bind mounts in development change this for source files — but installed dependencies still need a rebuild.

### 10.5 Database Data Disappeared

Section 5.2, live: destroy the container, and its filesystem goes with it.

```text
ERROR:  relation "notes" does not exist
```

Fix: a named volume on the data path, `-v notes-data:/var/lib/postgresql/data`. And before `docker compose down -v` on anything you care about — remember the `-v` deletes volumes too.

### 10.6 Docker Image Is Too Large

Ours: 1.71GB. Diagnose with:

```bash
docker history notes-api:1.0
```

Sort layers by size; the fat will announce itself. Then apply section 8: slimmer base, `.dockerignore`, dependency-order caching, multi-stage, `--omit=dev`, `npm cache clean`. Ours landed at 356MB.

### The Mental Map

- **Won't start** → `docker logs`
- **Connection refused (outside)** → `docker port`, `docker ps`
- **App can't reach DB** → network + service name + readiness
- **Changes not appearing** → rebuild with `--build`
- **Data gone** → volume was missing; `down -v` was run
- **Image huge** → `docker history`, then section 8

## 11. Useful Docker Commands

### 11.1 Container Commands

```bash
docker ps                          # running containers
docker ps -a                       # all containers
docker run -d --name x -p 8080:3000 img   # create + start
docker stop x / docker start x
docker rm x / docker rm -f x
docker exec -it x sh               # shell inside
docker logs -f x                   # stream logs
docker inspect x                   # full JSON state
```

### 11.2 Image Commands

```bash
docker build -t name:tag .
docker images
docker history name:tag            # layer breakdown
docker rmi name:tag
docker system df                   # disk usage summary
docker image prune -a              # delete unused images
```

### 11.3 Volume Commands

```bash
docker volume ls
docker volume create notes-data
docker volume inspect notes-data
docker volume rm notes-data
docker volume prune                # careful: deletes unused volumes
```

### 11.4 Network Commands

```bash
docker network ls
docker network create notes-net
docker network connect notes-net notes-api
docker network inspect notes-net   # who's attached, IPs
docker network rm notes-net
```

### 11.5 Compose Commands

```bash
docker compose up -d               # start the stack
docker compose up -d --build       # rebuild images first
docker compose ps
docker compose logs -f [service]
docker compose exec api sh         # shell into a service
docker compose restart api
docker compose down
docker compose down -v             # + delete volumes (careful)
```

### 11.6 Debugging Commands

```bash
docker logs --tail 100 -f x        # last 100 lines, streaming
docker inspect x | grep -i ip      # find the container's IP
docker exec x env                  # see resolved config
docker exec notes-api getent hosts notes-db   # test DNS
docker stats                       # live CPU/mem per container
docker system prune                # one-stop cleanup
```

## 12. Putting Everything Together

### 12.1 Final Application Architecture

The finished stack:

```
              ┌──────────────────────────────────────┐
              │            your machine              │
   :8080      │                                      │
   ──────────▶│  notes-api-1                         │
   published  │  node:22-slim · prod deps only       │
              │  healthcheck · restart policy        │
              │        │  notes-net (compose)        │
              │        ▼   hostname: db              │
              │  notes-db-1                          │
              │  postgres:17 · no published ports    │
              │        │                             │
              │        ▼                             │
              │  volume: notes-data                  │
              │  (survives down / redeploy)          │
              └──────────────────────────────────────┘
```

### 12.2 Dockerfile

The production Dockerfile — multi-stage, cache-ordered, slim:

```dockerfile
# ---- build stage ----
FROM node:22 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- production stage ----
FROM node:22-slim AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
```

Plus `.dockerignore`:

```
node_modules
dist
.git
.env
*.md
Dockerfile
compose.yaml
.dockerignore
```

### 12.3 Compose Configuration

`compose.yaml`:

```yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: notes
    volumes:
      - notes-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d notes"]
      interval: 5s
      timeout: 3s
      retries: 5

  api:
    build: .
    ports:
      - "8080:3000"
    environment:
      PGHOST: db
      PGUSER: postgres
      PGPASSWORD: postgres
      PGDATABASE: notes
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

volumes:
  notes-data:
```

### 12.4 Development Workflow

```bash
git pull
docker compose up -d --build
docker compose logs -f api
curl http://localhost:8080/health
```

Edit code → rebuild → test. Data in `notes-data` survives every rebuild.

### 12.5 Production Workflow

The same files, production discipline:

1. **Build once, tag deliberately**: `docker build -t yourregistry/notes-api:1.0.3 .`
2. **Push to a registry**: `docker push yourregistry/notes-api:1.0.3`
3. **Pull and run on the server** — same image, with production variables injected at run time
4. **Deploy = replace containers**, never mutate them — data lives in volumes, config in variables, so replacement is safe
5. Watch `docker compose ps` for `(healthy)`, logs for errors, `docker stats` for resources

## 13. Conclusion

### 13.1 The Docker Mental Model

If you keep one diagram from this article, keep this:

```text
Dockerfile ──build──▶ Image ──run──▶ Container
                        │               │
                     push/pull      logs, exec, stop
                        │               │
                     registry        volume ──▶ data survives

         images are immutable
         containers are disposable
         volumes persist
         networks connect
         environment variables configure
```

Once that clicks, every Docker command has an obvious place to live:

- Change code? Rebuild the image.
- App misbehaving? `docker logs`, then `docker exec`.
- Replace a container? Fine — if the data's on a volume.
- Connect two things? Put them on a network, use names.
- Different environment? Different variables, same image.

### 13.2 What to Learn Next

Where to go from here, in rough order:

- **CI/CD with Docker** — build, scan, and push images from a pipeline
- **Orchestration** — Kubernetes, Docker Swarm, or Compose in production
- **Registry and image security** — vulnerability scanning, signed images
- **Observability** — centralized logging, metrics, tracing for containers
- **Distroless and Alpine** — pushing image size and attack surface further

You don't need all of it. You need the mental model — and you have it now.

## 14. Resources

- **Docker Documentation** — [docs.docker.com](https://docs.docker.com)
- **Dockerfile reference** — [docs.docker.com/reference/dockerfile](https://docs.docker.com/reference/dockerfile)
- **Docker Compose documentation** — [docs.docker.com/compose](https://docs.docker.com/compose)
- **Compose file reference** — [docs.docker.com/reference/compose-file](https://docs.docker.com/reference/compose-file)
- **Node.js Docker Best Practices** — [github.com/nodejs/docker-node](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)

**The companion repository** — [github.com/shahadathhs/docker-notes-api](https://github.com/shahadathhs/docker-notes-api) — every file this article builds, ready to run: `docker compose up -d --build` gives you the working stack, and you can rebuild both image versions to reproduce the 1.71 GB → 356 MB comparison yourself. Its README also carries a complete Docker command cheat sheet.

**Related:** [*Useful Networking Commands for Deployment & Troubleshooting*](https://medium.com/@shahadathhs/useful-networking-commands-for-deployment-troubleshooting-30b904c59657) — the companion guide to diagnosing DNS, ports, firewalls, and TLS from the command line. The section 10 troubleshooting mindset, applied to the network itself.
