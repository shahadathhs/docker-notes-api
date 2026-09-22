# Docker Cheat Sheet: Beginner to Expert

The command reference companion to **[Docker Explained Through a Real Backend Application](https://medium.com/@shahadathhs/docker-explained-through-a-real-backend-application-4ee7a422dd38)** — every command with its flags, options, and examples. The article in [`ARTICLE.md`](ARTICLE.md) explains the concepts; this file is the quick lookup.

## 🚀 Getting Started with Docker

### Check Docker Installation

```bash
# Displays Docker version
docker --version
```

### Docker Help Commands

```bash
# General help
docker --help
# Help for a specific command (e.g., run)
docker <command> --help
```

---

## 🧱 Docker Basics

### Pull an Image

```bash
# Pulls an image from Docker Hub
docker pull <image-name>[:<tag>]
```

**Important Flags/Options:**

- `:tag` — Specify image tag (default: latest)

**Examples:**

```bash
docker pull ubuntu:22.04
```

### List Local Images

```bash
# Lists images stored locally
docker images [OPTIONS]
```

**Important Flags/Options:**

- `-a, --all` — Show all images (default hides intermediate layers)
- `--filter, -f` — Filter output based on conditions (e.g., "dangling=true")
- `--format` — Pretty-print using a Go template (e.g., "{{.Repository}}: {{.Tag}}")
- `--no-trunc` — Don't truncate output
- `-q, --quiet` — Only show numeric IDs

**Examples:**

```bash
docker images --filter "dangling=false" --format "{{.Repository}}:{{.Tag}} {{.Size}}"
```

### Run a Container

```bash
docker run [OPTIONS] <image-name> [COMMAND] [ARG...]
```

**Important Flags/Options:**

- `-d, --detach` — Run container in background and print container ID
- `-i, --interactive` — Keep STDIN open even if not attached
- `-t, --tty` — Allocate a pseudo-TTY (combine with `-i` for interactive shell)
- `--rm` — Automatically remove the container when it exits
- `--name` — Assign a name to the container
- `-p, --publish` — Publish a container's port(s) to the host (e.g., `-p 8080:80`)
- `-e, --env` — Set environment variables (e.g., `-e ENV_VAR=value`)
- `-v, --volume` — Bind mount a volume (e.g., `-v host_path:container_path`)
- `-w, --workdir` — Working directory inside the container
- `--network` — Connect a container to a network (e.g., `--network my-network`)
- `--user` — Username or UID (e.g., `--user 1000:1000`)
- `--restart` — Restart policy (`no`, `on-failure[:max-retries]`, `always`, `unless-stopped`)

**Examples:**

```bash
# Interactive Ubuntu shell
docker run -it ubuntu:22.04 /bin/bash
# Run in background, name it "webapp", map port 8080 to 80, and remove on exit
docker run -d --name webapp --rm -p 8080:80 nginx:latest
# Run and mount local "mydata" folder to "/app/data" inside container
docker run -it -v $(pwd)/mydata:/app/data node:16-alpine sh
```

### Run a Container in Detached Mode

```bash
docker run -d [OPTIONS] <image-name>
```

_Same OPTIONS as `docker run` above._

**Example:**

```bash
docker run -d --name db-server -e POSTGRES_PASSWORD=secret -v pgdata:/var/lib/postgresql/data postgres:14
```

### Name a Container on Run

```bash
# Assigns a custom name to the container
docker run --name <container-name> [OPTIONS] <image-name>
```

**Example:**

```bash
docker run --name my-redis -d redis:7
```

### Auto-Remove Container on Exit

```bash
# Automatically removes the container filesystem after it exits
docker run --rm [OPTIONS] <image-name>
```

**Example:**

```bash
docker run --rm ubuntu:22.04 echo "Hello Docker"
```

### Tag an Image

```bash
docker tag <image-id> <repository>/<image-name>:<tag>
```

**Example:**

```bash
# Tagging local image ID d1e3f to "myrepo/myapp:1.0"
docker tag d1e3f myrepo/myapp:1.0
```

### Remove a Container

```bash
# Stop and remove a container in one command
docker rm [OPTIONS] <container-id or name>
```

**Important Flags/Options:**

- `-f, --force` — Force the removal of a running container (uses SIGKILL)
- `-v, --volumes` — Remove anonymous volumes associated with the container

**Example:**

```bash
docker rm -f -v old-container
```

### Remove an Image

```bash
# Removes one or more images
docker rmi [OPTIONS] <image-name or ID>
```

**Important Flags/Options:**

- `-f, --force` — Force removal of the image (even if tagged in multiple repositories)
- `--no-prune` — Do not delete untagged parent images

**Example:**

```bash
docker rmi -f myrepo/myapp:1.0
```

---

## 🧩 Container Management

### List Running Containers

```bash
docker ps [OPTIONS]
```

**Important Flags/Options:**

- `-a, --all` — Show all containers (default shows just running)
- `-q, --quiet` — Only display container IDs
- `--filter` — Filter output (e.g., `"status=exited"`, `"name=myapp"`)
- `--format` — Pretty-print using a Go template (e.g., "{{.ID}}: {{.Names}}")

**Example:**

```bash
docker ps --filter "status=exited" --format "{{.ID}}\t{{.Names}}"
```

### List All Containers (including stopped)

```bash
docker ps -a [OPTIONS]
```

_Same OPTIONS as `docker ps` above._

### Stop a Container

```bash
docker stop [OPTIONS] <container-id or name> [<container-id or name>...]
```

**Important Flags/Options:**

- `-t, --time` — Seconds to wait for stop before killing it (default: 10)

**Example:**

```bash
docker stop -t 5 my-redis
```

### Start a Stopped Container

```bash
docker start [OPTIONS] <container-id or name> [<container-id or name>...]
```

**Important Flags/Options:**

- `-a, --attach` — Attach STDOUT/STDIN and forward signals
- `-i, --interactive` — Attach container's STDIN

**Example:**

```bash
docker start -ai my-redis
```

### View Container Logs

```bash
docker logs [OPTIONS] <container-id or name>
```

**Important Flags/Options:**

- `-f, --follow` — Follow log output (like `tail -f`)
- `--since` — Show logs since a timestamp (e.g., `2025-06-01T15:00:00`)
- `--until` — Show logs up to a timestamp
- `--tail` — Number of lines to show from the end (e.g., `--tail 100`)
- `--timestamps` — Show timestamps

**Example:**

```bash
docker logs -f --tail 50 my-redis
```

### Execute a Command in a Running Container

```bash
docker exec [OPTIONS] <container-id or name> <command> [ARG...]
```

**Important Flags/Options:**

- `-d, --detach` — Detached mode: run command in the background
- `-i, --interactive` — Keep STDIN open even if not attached
- `-t, --tty` — Allocate a pseudo-TTY
- `-u, --user` — Username or UID (e.g., `-u root`)
- `-w, --workdir` — Working directory inside the container

**Example:**

```bash
docker exec -it -u root my-container bash
```

### Inspect a Container

```bash
docker inspect [OPTIONS] <container-id or name>
```

**Important Flags/Options:**

- `--format` — Format output using a Go template (e.g., `"{{json .Mounts}}"`)

**Example:**

```bash
docker inspect --format '{{.Config.Cmd}}' my-container
```

### Rename a Container

```bash
docker rename <old-name> <new-name>
```

**Example:**

```bash
docker rename old-container new-container
```

### Force Remove Running Container

```bash
docker rm -f <container-id or name>
```

**Example:**

```bash
docker rm -f praiseworthy-container
```

---

## 📡 Networking

### List Networks

```bash
docker network ls [OPTIONS]
```

**Important Flags/Options:**

- `--filter` — Filter output (e.g., `"driver=bridge"`)
- `-q, --quiet` — Only display network IDs

**Example:**

```bash
docker network ls --filter "driver=overlay"
```

### Create a Network

```bash
docker network create [OPTIONS] <network-name>
```

**Important Flags/Options:**

- `--driver` — Driver to manage the Network (default: bridge)
- `--subnet` — Subnet in CIDR form (e.g., `--subnet 192.168.1.0/24`)
- `--gateway` — IPv4 or IPv6 Gateway for the master subnet
- `--opt` — Set driver-specific options (e.g., `--opt encrypted=true`)

**Example:**

```bash
docker network create --driver overlay --subnet 10.0.9.0/24 my-overlay-net
```

### Connect a Container to a Network

```bash
docker network connect [OPTIONS] <network-name> <container-id or name>
```

**Important Flags/Options:**

- `--alias` — Add network-scoped alias for the container

**Example:**

```bash
docker network connect --alias webapp app-network web-container
```

### Disconnect a Container from a Network

```bash
docker network disconnect [OPTIONS] <network-name> <container-id or name>
```

**Important Flags/Options:**

- `-f, --force` — Force the container to disconnect from the network

**Example:**

```bash
docker network disconnect -f app-network web-container
```

### Inspect a Network

```bash
docker network inspect [OPTIONS] <network-name>
```

**Important Flags/Options:**

- `--format` — Format output using a Go template

**Example:**

```bash
docker network inspect --format '{{json .IPAM.Config}}' my-network
```

---

## 💾 Volumes and Data Management

### Create a Volume

```bash
docker volume create [OPTIONS] <volume-name>
```

**Important Flags/Options:**

- `--driver` — Specifies volume driver to use (default: local)
- `--label` — Set metadata on volume (e.g., `--label project=alpha`)

**Example:**

```bash
docker volume create --label purpose=dbdata mydbvolume
```

### List Volumes

```bash
docker volume ls [OPTIONS]
```

**Important Flags/Options:**

- `-q, --quiet` — Only display volume names
- `--filter` — Filter output (e.g., `"dangling=true"`)

**Example:**

```bash
docker volume ls --filter "dangling=true"
```

### Remove a Volume

```bash
docker volume rm [OPTIONS] <volume-name> [<volume-name>...]
```

**Important Flags/Options:**

- `-f, --force` — Force removal of one or more volumes

**Example:**

```bash
docker volume rm -f oldvolume1 oldvolume2
```

### Mount a Volume to a Container

```bash
# Named volume mount
docker run -v <volume-name>:<container-path> [OPTIONS] <image-name>
# Bind mount host directory
docker run -v $(pwd)/host_dir:<container-path> [OPTIONS] <image-name>
```

**Example:**

```bash
docker run -d -v mydbvolume:/var/lib/postgresql/data -e POSTGRES_PASSWORD=secret postgres:14
```

### Inspect Volume

```bash
docker volume inspect [OPTIONS] <volume-name>
```

**Important Flags/Options:**

- `--format` — Format output using a Go template

**Example:**

```bash
docker volume inspect --format '{{.Mountpoint}}' mydbvolume
```

---

## 🛠 Dockerfile and Building Images

### Dockerfile Basic Structure

```Dockerfile
# Base image
FROM <base-image>:<tag>

# Labels and metadata
LABEL maintainer="<your-name>"
LABEL version="1.0"

# Create and set working directory
WORKDIR /app

# Copy application files
COPY . /app

# Install dependencies
RUN <command>  # e.g., `npm install`

# Expose ports
EXPOSE <port>   # e.g., `EXPOSE 3000`

# Run the application
CMD ["<executable>"]  # e.g., `CMD ["npm", "start"]`
```

### Build an Image

```bash
docker build [OPTIONS] -t <repository>/<image-name>:<tag> <path-to-Dockerfile-dir>
```

**Important Flags/Options:**

- `-f, --file <file>` — Name of the Dockerfile (default: './Dockerfile')
- `--no-cache` — Do not use cache when building the image
- `--pull` — Always attempt to pull a newer version of the base image
- `--build-arg <var>=<value>` — Set build-time variables
- `--platform` — Set target platform for build (e.g., `--platform linux/amd64`)
- `-q, --quiet` — Suppress verbose build output, print only image ID

**Example:**

```bash
docker build --no-cache --pull -t myrepo/myapp:latest .
```

### List Built Images

```bash
docker images [OPTIONS]
```

_Refer to flags in "List Local Images" section._

---

## 📦 Image Management

### Tag an Image (Retrospective)

```bash
docker tag [OPTIONS] <image-id> <repository>/<image-name>:<tag>
```

_Refer to "Tag an Image" above._

### Remove an Image

```bash
docker rmi [OPTIONS] <image-name or ID> [...]
```

_Refer to flags in "Remove an Image" above._

### Save an Image to Tar

```bash
docker save [OPTIONS] -o <file-name>.tar <image-name>:<tag>
```

**Important Flags/Options:**

- `-o, --output` — Write to a file, instead of STDOUT
- `--quiet` — Suppress verbose output

**Example:**

```bash
docker save --quiet -o myapp_v1.tar myrepo/myapp:1.0
```

### Load an Image from Tar

```bash
docker load [OPTIONS] -i <file-name>.tar
```

**Important Flags/Options:**

- `-i, --input` — Read from tar archive file, instead of STDIN
- `--quiet` — Suppress verbose output

**Example:**

```bash
docker load --quiet -i myapp_v1.tar
```

### Push Image to Docker Hub

```bash
# Log in first
docker login [OPTIONS]
# Push tagged image to registry
docker push [OPTIONS] <repository>/<image-name>:<tag>
```

**Important Flags/Options for login:**

- `--username, -u` — Username
- `--password-stdin` — Take password from STDIN rather than via prompt

**Important Flags/Options for push:**

- `--disable-content-trust` — Skip image signing (default: true)
- `--quiet` — Suppress verbose output

**Example:**

```bash
echo "my_secret_password" | docker login --username myuser --password-stdin
docker push myrepo/myapp:1.0
```

---

## 🧪 Docker Compose

### Docker Compose Basic Commands

```bash
docker-compose [OPTIONS] up [OPTIONS] [SERVICE...]
```

**Important Flags/Options for `up`:**

- `-d, --detach` — Run containers in the background
- `--build` — Build images before starting containers
- `--no-build` — Don't build an image, even if it's missing
- `--force-recreate` — Recreate containers even if their configuration and image haven't changed
- `--no-recreate` — If containers already exist, don't recreate them
- `--remove-orphans` — Remove containers for services not defined in the Compose file

```bash
docker-compose [OPTIONS] down [OPTIONS]
```

**Important Flags/Options for `down`:**

- `-v, --volumes` — Remove named volumes declared in the `volumes` section of the Compose file and anonymous volumes attached to containers
- `--rmi [all|local]` — Remove images. `all`: Remove all images used by any service. `local`: Remove only images that don't have a repository specified
- `--remove-orphans` — Remove containers for services not defined in the Compose file

```bash
# Scale a specific service to N instances
docker-compose up --scale <service-name>=<count>
```

### View Compose Services

```bash
docker-compose ps [OPTIONS]
```

**Important Flags/Options:**

- `-q, --quiet` — Only display IDs
- `--services` — Display services
- `--filter` — Filter services by conditions (e.g., `"status=running"`)

**Example:**

```bash
docker-compose ps --services --filter "status=running"
```

### Logs for Compose Services

```bash
docker-compose logs [OPTIONS] [SERVICE...]
```

**Important Flags/Options:**

- `-f, --follow` — Follow log output
- `--tail="all"` — Number of lines to show from the end
- `-t, --timestamps` — Show timestamps

**Example:**

```bash
docker-compose logs -f --tail=100 web
```

---

## 🧹 Cleanup and Maintenance

### Remove All Stopped Containers

```bash
docker container prune [OPTIONS]
```

**Important Flags/Options:**

- `-f, --force` — Do not prompt for confirmation
- `--filter` — Provide filter values (e.g., `"until=24h"`)

**Example:**

```bash
docker container prune -f --filter "until=48h"
```

### Remove Unused Images

```bash
docker image prune [OPTIONS]
```

**Important Flags/Options:**

- `-a, --all` — Remove all unused images, not just dangling ones
- `-f, --force` — Do not prompt for confirmation
- `--filter` — Provide filter values (e.g., `"label!=keep"`)

**Example:**

```bash
docker image prune -a -f --filter "until=72h"
```

### Remove All Unused Data (Containers, Networks, Images, Build Cache)

```bash
docker system prune [OPTIONS]
```

**Important Flags/Options:**

- `-a, --all` — Remove all unused images, not just dangling ones
- `--volumes` — Prune volumes as well
- `-f, --force` — Do not prompt for confirmation
- `--filter` — Provide filter values (e.g., `"label!=keep"`)

**Example:**

```bash
docker system prune -a --volumes -f --filter "until=24h"
```

### Detailed Cleanup (Images, Containers, Volumes, Networks)

```bash
docker system prune -a --volumes --force
```

---

## 📊 System and Debugging

### Get Docker System Info

```bash
docker info [OPTIONS]
```

**Important Flags/Options:**

- `--format` — Format output using a Go template (e.g., `"{{.Driver}}"`)

**Example:**

```bash
docker info --format '{{json .Plugins}}'
```

### Check Container Stats (Real-Time)

```bash
docker stats [OPTIONS] [CONTAINER...]
```

**Important Flags/Options:**

- `-a, --all` — Show all containers (default shows running only)
- `--format` — Format output using a Go template (e.g., `"{{.Name}}: {{.CPUPerc}}"`)

**Example:**

```bash
docker stats --format "table {{.Name}}\t{{.MemUsage}}\t{{.NetIO}}"
```

### Top Processes in a Container

```bash
docker top <container-id or name> [ps OPTIONS]
```

**Important Flags/Options:**

- You can pass `ps` options (e.g., `aux`) to view processes inside the container

**Example:**

```bash
docker top my-container aux
```

### Inspect Container, Image, or Network (Retrospective)

```bash
# Container
docker inspect [OPTIONS] <container-id or name>
# Image
docker inspect [OPTIONS] <image-name or ID>
# Network
docker inspect [OPTIONS] <network-name>
```

_Refer to flags in previous sections._

---

## 🧠 Expert Tips

### Copy Files From Container

```bash
docker cp [OPTIONS] <container-id or name>:<container-path> <host-path>
```

**Important Flags/Options:**

- `--archive, -a` — Archive mode (copy all UID/GID information)

**Example:**

```bash
docker cp -a my-container:/var/log/app.log ./app.log
```

### Copy Files To Container

```bash
docker cp [OPTIONS] <host-path> <container-id or name>:<container-path>
```

_Refer to flags above._

### Create Image from Container (Commit Changes)

```bash
docker commit [OPTIONS] <container-id or name> <new-image-name>[:<tag>]
```

**Important Flags/Options:**

- `-a, --author` — Author (e.g., "Jane Doe <jane@example.com>")
- `-m, --message` — Commit message

**Example:**

```bash
docker commit -a "Sajib" -m "Added config changes" my-container sabi/app:latest
```

### Connect to Container with Docker Attach (Caution!)

```bash
docker attach [OPTIONS] <container-id or name>
```

**Important Flags/Options:**

- `--sig-proxy` — Proxy all received signals to the process (default: true). Use caution as it can send SIGINT to process inside container.

**Example:**

```bash
docker attach --sig-proxy=false my-long-running-service
```

### Export Container Filesystem

```bash
docker export [OPTIONS] <container-id or name>
```

**Important Flags/Options:**

- `-o, --output` — Write to a file instead of STDOUT

**Example:**

```bash
docker export -o mycontainer_fs.tar my-container
```

### Import Container Filesystem

```bash
docker import [OPTIONS] <file-name>.tar <repository>/<image-name>:<tag>
```

**Important Flags/Options:**

- `--change, -c` — Apply Dockerfile instructions (e.g., `-c "LABEL version=1.0"`)

**Example:**

```bash
docker import -c "LABEL imported=true" mycontainer_fs.tar myrepo/imported-image:1.0
```
