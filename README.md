# Chaos Mesh Microservice System

A multi-microservice system deployed on Kubernetes (Minikube) with Chaos Mesh for chaos engineering experiments. The system features interdependent services to demonstrate realistic cascading failures.

## Architecture

```
              [Browser]
                  |
           [API Gateway]  :3000 (NodePort 30000)
              /        \
     [Order Service]   [User Service]   (ClusterIP)
              \        /
        [Inventory Service]   (ClusterIP - leaf)
```

- **API Gateway** — Entry point. Routes requests to order, user, and inventory services. Reports aggregate health status.
- **Order Service** — Manages orders. Calls inventory-service to enrich orders with product data.
- **User Service** — Manages users. Calls inventory-service to get purchase history details.
- **Inventory Service** — Leaf service with no dependencies. Manages product inventory. Killing this cascades failures to all other services.
- **MongoDB** — Shared database. Each service uses its own database (inventory, orders, users). Killing MongoDB cascades failures to all services.

## Project Structure

```
chaos-mesh-microservice/
├── services/
│   ├── api-gateway/          (index.js, package.json, Dockerfile)
│   ├── order-service/        (index.js, package.json, Dockerfile)
│   ├── user-service/         (index.js, package.json, Dockerfile)
│   └── inventory-service/    (index.js, package.json, Dockerfile)
├── k8s/
│   ├── api-gateway.yaml
│   ├── order-service.yaml
│   ├── user-service.yaml
│   └── inventory-service.yaml
├── chaos/
│   ├── 01-pod-kill.yaml           (all services)
│   ├── 02-pod-failure.yaml        (all services)
│   ├── 03-network-delay.yaml      (all services)
│   ├── 04-network-loss.yaml       (all services)
│   ├── 05-cpu-stress.yaml         (all services)
│   ├── 06-memory-stress.yaml      (all services)
│   ├── 07-kill-inventory.yaml     (inventory only - cascading)
│   ├── 08-delay-order-service.yaml (order-service only)
│   ├── 09-network-partition.yaml  (frontend ↔ data partition)
│   └── 10-kill-mongodb.yaml       (database - total failure)
├── scripts/
│   ├── install/
│   │   ├── install_docker_minikube.sh
│   │   └── install_docker_minikube_amazon_linux.sh
│   ├── uninstall/
│   │   ├── uninstall_docker_minikube.sh
│   │   └── uninstall_docker_minikube_amazon_linux.sh
│   └── services/
│       ├── build-all.sh
│       ├── deploy-all.sh
│       ├── start-app.sh
│       ├── stop-app.sh
│       ├── start-dashboard.sh
│       └── stop-dashboard.sh
└── README.md
```

## Prerequisites

- EC2 instance with at least **4GB RAM** (t3.medium recommended)
- Ubuntu or Amazon Linux 2023
- Ports **3000**, **2333**, **30000** open in AWS Security Group

## Quick Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd chaos-mesh-microservice
```

### 2. Run the install script

**Ubuntu:**
```bash
chmod +x scripts/install/install_docker_minikube.sh
./scripts/install/install_docker_minikube.sh
```

**Amazon Linux:**
```bash
chmod +x scripts/install/install_docker_minikube_amazon_linux.sh
./scripts/install/install_docker_minikube_amazon_linux.sh
```

The script automatically installs (skips if already present):
- Docker
- Minikube
- kubectl
- Helm
- Chaos Mesh (via Helm)

### 3. Build all service images

```bash
chmod +x scripts/services/build-all.sh
./scripts/services/build-all.sh
```

This builds Docker images for all 4 services and loads them into Minikube.

**Low memory alternative:** If `minikube image load` gets killed (OOM), the script automatically falls back to `minikube image build`.

### 4. Deploy all services

```bash
chmod +x scripts/services/deploy-all.sh
./scripts/services/deploy-all.sh
```

### 5. Verify deployment

```bash
kubectl get pods -l project=chaosmesh-microservice
kubectl get svc
```

Expected: 10 pods (1 mongodb + 3 gateway + 2 order + 2 user + 2 inventory), all Running.

## Accessing the System

### From the server

```bash
curl http://$(minikube ip):30000/health
curl http://$(minikube ip):30000/api/status
```

### From your local machine

```bash
./scripts/services/start-app.sh
```

Then open: `http://<server-public-ip>:3000`

To stop: `./scripts/services/stop-app.sh`

## API Endpoints

### API Gateway (entry point)

| Method | Endpoint          | Description                                    |
|--------|-------------------|------------------------------------------------|
| GET    | `/health`         | Aggregate health of all services               |
| GET    | `/api/status`     | Detailed status with response times            |
| GET    | `/api/orders`     | List orders (via order-service + inventory)     |
| GET    | `/api/orders/:id` | Single order with product details              |
| GET    | `/api/users`      | List users (via user-service)                  |
| GET    | `/api/users/:id`  | User with purchase history (via inventory)     |
| GET    | `/api/inventory`  | List inventory items                           |
| GET    | `/api/message`    | Simple status message                          |

### Internal Services

| Service           | Endpoint              | Description              |
|-------------------|-----------------------|--------------------------|
| order-service     | `/health`             | Health + dependency check |
| order-service     | `/api/orders`         | Orders with product data |
| order-service     | `/api/orders/:id`     | Single order             |
| user-service      | `/health`             | Health + dependency check |
| user-service      | `/api/users`          | User list                |
| user-service      | `/api/users/:id`      | User with purchases      |
| inventory-service | `/health`             | Health check             |
| inventory-service | `/api/inventory`      | All inventory items      |
| inventory-service | `/api/inventory/:id`  | Single item              |

## Chaos Mesh Dashboard

### Access the dashboard

```bash
./scripts/services/start-dashboard.sh
```

Open: `http://<server-public-ip>:2333`

To stop: `./scripts/services/stop-dashboard.sh`

### Get login token

```bash
kubectl create token chaos-dashboard -n chaos-mesh
```

Copy the token and paste it on the dashboard login page.

## Kubernetes Configuration

| Service           | Replicas | Service Type | External Port | Database     |
|-------------------|----------|-------------|---------------|--------------|
| mongodb           | 1        | ClusterIP   | -             | -            |
| api-gateway       | 3        | NodePort    | 30000         | none         |
| order-service     | 2        | ClusterIP   | -             | orders       |
| user-service      | 2        | ClusterIP   | -             | users        |
| inventory-service | 2        | ClusterIP   | -             | inventory    |

**Labels for chaos targeting:**
- `project: chaosmesh-microservice` — targets all services
- `app: <service-name>` — targets specific service (api-gateway, order-service, user-service, inventory-service, mongodb)
- `tier: frontend|backend|data|database` — targets by tier

## Chaos Experiments

All experiment YAMLs are in the `chaos/` folder.

### How to run an experiment

```bash
# Apply an experiment
kubectl apply -f chaos/<experiment-file>.yaml

# Watch your pods during the experiment
kubectl get pods -w

# Check experiment status
kubectl get podchaos,networkchaos,stresschaos,schedule

# Remove an experiment
kubectl delete -f chaos/<experiment-file>.yaml
```

### System-Wide Experiments (target all services)

#### 1. Pod Kill — kills one random pod every minute

```bash
kubectl apply -f chaos/01-pod-kill.yaml
```

- **What it does:** Kills 1 random pod from any service every minute
- **What to observe:** `curl /api/status` shows which services are affected

#### 2. Pod Failure — makes 40% of pods unavailable

```bash
kubectl apply -f chaos/02-pod-failure.yaml
```

- **What it does:** Makes 40% of all pods fail for 60s
- **What to observe:** Some services go down, gateway shows DEGRADED status

#### 3. Network Delay — adds 500ms latency

```bash
kubectl apply -f chaos/03-network-delay.yaml
```

- **What it does:** Adds 500ms delay to all pod traffic
- **What to observe:** `/api/status` shows increased response times, inter-service calls slow down

#### 4. Network Loss — drops 30% of packets

```bash
kubectl apply -f chaos/04-network-loss.yaml
```

- **What it does:** Drops 30% of packets on all pods
- **What to observe:** Intermittent failures on `/api/orders` and `/api/users`

#### 5. CPU Stress — overloads CPU

```bash
kubectl apply -f chaos/05-cpu-stress.yaml
```

- **What it does:** Uses 2 CPU workers at 80% on 1 random pod
- **What to observe:** That pod's service slows down

#### 6. Memory Stress — consumes memory

```bash
kubectl apply -f chaos/06-memory-stress.yaml
```

- **What it does:** Consumes 128MB memory on 1 random pod
- **What to observe:** Pod may get OOMKilled and auto-restart

### Targeted Experiments (cascading failures)

#### 7. Kill Inventory Service — cascading failure demo

```bash
kubectl apply -f chaos/07-kill-inventory.yaml
```

- **What it does:** Kills ALL inventory-service pods
- **What to observe:** This is the best demo — hit `/api/status` and see inventory DOWN, then `/api/orders` shows `"inventory-service unavailable"` in product data, `/api/users/:id` shows unavailable purchase details
- **Why it matters:** Shows how a leaf service failure cascades through the entire system

#### 8. Delay Order Service — partial degradation

```bash
kubectl apply -f chaos/08-delay-order-service.yaml
```

- **What it does:** Adds 500ms delay to order-service only
- **What to observe:** `/api/orders` becomes slow but `/api/users` stays fast — demonstrates partial degradation

#### 9. Network Partition — frontend/data split

```bash
kubectl apply -f chaos/09-network-partition.yaml
```

- **What it does:** Partitions frontend tier (gateway) from data tier (inventory)
- **What to observe:** Gateway can't reach inventory directly, but order/user services (backend tier) may still reach it

#### 10. Kill MongoDB — total database failure

```bash
kubectl apply -f chaos/10-kill-mongodb.yaml
```

- **What it does:** Kills the MongoDB pod
- **What to observe:** All services report `mongodb: DOWN` in health checks. `/api/orders`, `/api/users`, `/api/inventory` return `"Database unavailable"`. Gateway shows DEGRADED status for all services.
- **Why it matters:** Demonstrates total system failure when the shared database goes down

### Cleanup all experiments

```bash
kubectl delete -f chaos/
```

## Useful Commands

```bash
# Pod management
kubectl get pods -l project=chaosmesh-microservice
kubectl logs -l app=api-gateway
kubectl logs -l app=order-service
kubectl logs -l app=inventory-service
kubectl rollout restart deployment api-gateway order-service user-service inventory-service

# Stop everything (stop port-forward first, then scale down)
./scripts/services/stop-app.sh
kubectl scale deployment api-gateway order-service user-service inventory-service --replicas=0

# Start everything (scale up first, wait for ready, then port-forward)
kubectl scale deployment api-gateway --replicas=3
kubectl scale deployment order-service user-service inventory-service --replicas=2
kubectl wait --for=condition=ready pod -l project=chaosmesh-microservice --timeout=60s
./scripts/services/start-app.sh

# Rebuild and redeploy a single service
docker build -t order-service services/order-service
minikube image load order-service
kubectl rollout restart deployment order-service

# Revert Docker env to host (if you used minikube docker-env)
eval $(minikube docker-env --unset)
```

## Troubleshooting

### kubectl: "dial tcp 192.168.49.2:8443: connect: no route to host"

This means the Minikube cluster is not running. Common causes:
- EC2 instance was **stopped and restarted** (Minikube doesn't survive reboots)
- Docker service is not running

**Fix:**

```bash
# 1. Check if Docker is running
sudo systemctl status docker

# If Docker is stopped, start it
sudo systemctl start docker

# 2. Check Minikube status
minikube status

# 3. Start Minikube
minikube start

# 4. If start fails, delete and recreate
minikube delete
minikube start --driver=docker
```

After `minikube start` succeeds, re-run the install script to reinstall Chaos Mesh, then redeploy:

```bash
./scripts/services/deploy-all.sh
```

### Port-forward dies immediately

Check the log for errors:

```bash
cat /tmp/chaosmesh-app.log
```

Common causes:
- Service name mismatch — verify with `kubectl get svc`
- Port already in use — kill any `pnpm` or `node` process on port 3000
- Pods not ready — wait for pods: `kubectl wait --for=condition=ready pod -l app=api-gateway --timeout=60s`

### Service endpoints empty

If `kubectl describe svc <name>` shows `Endpoints: <none>`, the service selector doesn't match pod labels. Verify labels:

```bash
kubectl get pods --show-labels
kubectl describe svc <service-name>
```

## Uninstall

**Ubuntu:**
```bash
chmod +x scripts/uninstall/uninstall_docker_minikube.sh
./scripts/uninstall/uninstall_docker_minikube.sh
```

**Amazon Linux:**
```bash
chmod +x scripts/uninstall/uninstall_docker_minikube_amazon_linux.sh
./scripts/uninstall/uninstall_docker_minikube_amazon_linux.sh
```

This removes: Chaos Mesh, Minikube, Helm, kubectl, and Docker (in reverse order).

## Minikube Notes

- Minikube IP (default `192.168.49.2`) stays the same across stop/start cycles but changes after `minikube delete` + `minikube start`
- Check IP anytime: `minikube ip`
- Minikube needs at least 1800MB RAM available to Docker
- Build images on local Docker and load into minikube with `minikube image load <image>` — avoids Docker context switching



Special note 
# 1. Go to the repo root    cd ~/chaos-mesh-microservice                                                                                                                                       
                                                                                                                                                                     
  # 2. Confirm you're in the right place (should list all four service dirs)                                                                                           ls services/                                                                                                                                                       
                                                                                                                                                                       # 3. Make sure docker-env is NOT pointing at minikube (we want minikube's own builder)                                                                             
  eval $(minikube docker-env --unset)                                                                                                                                
  
  # 4. Build each service inside minikube
  minikube image build -t api-gateway       services/api-gateway
  minikube image build -t user-service      services/user-service
  minikube image build -t order-service     services/order-service
  minikube image build -t inventory-service services/inventory-service

  # 5. Verify all four are present
  minikube image ls | grep -E "api-gateway|user-service|order-service|inventory-service"

  Expected output from step 5:
  docker.io/library/api-gateway:latest
  docker.io/library/user-service:latest
  docker.io/library/order-service:latest
  docker.io/library/inventory-service:latest

  Then proceed to deploy:

  ./scripts/services/deploy-all.sh

※ recap: You're getting the four microservices running on minikube after an EC2 instance-type change broke `minikube image load`. Next: from 
  `~/chaos-mesh-microservice`, run `minikube image build -t <svc> services/<svc>` for all four services, then `./scripts/services/deploy-all.sh`.
  
