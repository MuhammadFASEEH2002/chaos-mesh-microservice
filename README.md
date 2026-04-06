# Chaos Mesh Microservice

A Node.js microservice deployed on Kubernetes (Minikube) with Chaos Mesh for chaos engineering experiments.

## Project Structure

```
chaos-mesh-microservice/
├── .dockerignore
├── .gitignore
├── Dockerfile
├── index.js
├── package.json
├── pnpm-lock.yaml
├── chaos/
│   ├── 01-pod-kill.yaml
│   ├── 02-pod-failure.yaml
│   ├── 03-network-delay.yaml
│   ├── 04-network-loss.yaml
│   ├── 05-cpu-stress.yaml
│   └── 06-memory-stress.yaml
├── k8s/
│   └── deployment.yaml
├── scripts/
│   ├── install/
│   │   ├── install_docker_minikube.sh
│   │   └── install_docker_minikube_amazon_linux.sh
│   ├── uninstall/
│   │   ├── uninstall_docker_minikube.sh
│   │   └── uninstall_docker_minikube_amazon_linux.sh
│   └── services/
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

### 3. Build and deploy the microservice

```bash
# Make sure you're on local Docker (not minikube's)
eval $(minikube docker-env -u)

# Build the image locally
docker build -t chaosmesh-microservice .

# Load the image into minikube
minikube image load chaosmesh-microservice

# Deploy to Kubernetes
kubectl apply -f k8s/deployment.yaml
```

> **Important:** Do NOT build inside minikube's Docker (`eval $(minikube docker-env)`) — it causes version mismatch errors. Always build on local Docker and use `minikube image load` to transfer the image.

**Low memory alternative:** If `minikube image load` gets killed (OOM), build directly inside minikube instead:

```bash
minikube image build -t chaosmesh-microservice .
kubectl apply -f k8s/deployment.yaml
```

### 4. Verify deployment

```bash
kubectl get pods
kubectl get svc
```

## Accessing the Microservice

### From the server

```bash
curl http://$(minikube ip):30000/health
curl http://$(minikube ip):30000/api/message
```

### From your local machine

```bash
./scripts/services/start-app.sh
```

Then open: `http://<server-public-ip>:3000/health`

To stop: `./scripts/services/stop-app.sh`

## API Endpoints

| Method | Endpoint       | Description                  |
|--------|----------------|------------------------------|
| GET    | `/health`      | Health check with timestamp  |
| GET    | `/api/message` | Returns a status message     |

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

- **Deployment**: 5 replicas of the Node.js app
- **Service**: NodePort type, exposed on port 30000
- **Health checks**: Liveness and readiness probes on `/health`
- **Container port**: 3000

## Chaos Experiments

All experiment YAMLs are in the `chaos/` folder. Run them in order (simple → severe).

### How to run an experiment

```bash
# Apply an experiment
kubectl apply -f chaos/<experiment-file>.yaml

# Watch your pods during the experiment
kubectl get pods -w

# Check experiment status
kubectl get podchaos,networkchaos,stresschaos

# Remove an experiment (stops it immediately)
kubectl delete -f chaos/<experiment-file>.yaml
```

### 1. Pod Kill — kills one random pod

```bash
kubectl apply -f chaos/01-pod-kill.yaml
```

- **What it does:** Kills 1 pod instantly
- **Duration:** 30s (Kubernetes will recreate the pod)
- **What to observe:** Run `kubectl get pods -w` — you should see a pod terminate and a new one spin up
- **Test your app:** `curl http://<server-ip>:3000/health` — should still respond because other pods are alive

### 2. Pod Failure — makes 40% of pods unavailable

```bash
kubectl apply -f chaos/02-pod-failure.yaml
```

- **What it does:** Makes 40% of pods (2 out of 5) fail for 60s
- **Duration:** 60s then auto-recovers
- **What to observe:** 2 pods go to NotReady state, traffic routes to remaining 3
- **Test your app:** Hit the health endpoint repeatedly — should still work but slower

### 3. Network Delay — adds 500ms latency

```bash
kubectl apply -f chaos/03-network-delay.yaml
```

- **What it does:** Adds 500ms delay (±100ms jitter) to all pod network traffic
- **Duration:** 60s
- **What to observe:** API responses become noticeably slower
- **Test your app:** `time curl http://<server-ip>:3000/health` — response time should be ~500ms+

### 4. Network Loss — drops 30% of packets

```bash
kubectl apply -f chaos/04-network-loss.yaml
```

- **What it does:** Drops 30% of network packets on all pods
- **Duration:** 60s
- **What to observe:** Some requests fail, some succeed
- **Test your app:** Run multiple curls — some will timeout or fail

### 5. CPU Stress — overloads CPU

```bash
kubectl apply -f chaos/05-cpu-stress.yaml
```

- **What it does:** Uses 2 workers at 80% CPU load on 1 pod
- **Duration:** 60s
- **What to observe:** `kubectl top pod` shows high CPU on one pod, response times increase
- **Test your app:** Hit the endpoint — the stressed pod will be slower

### 6. Memory Stress — consumes memory

```bash
kubectl apply -f chaos/06-memory-stress.yaml
```

- **What it does:** Consumes 128MB memory on 1 pod using 2 workers
- **Duration:** 60s
- **What to observe:** `kubectl top pod` shows high memory usage, pod may get OOMKilled
- **Test your app:** If pod gets killed, Kubernetes recreates it automatically

### Cleanup all experiments

```bash
kubectl delete -f chaos/
```

## Useful Commands

### Pod Management

```bash
# List all pods
kubectl get pods

# Delete all pods (deployment will recreate them automatically)
kubectl delete pods -l app=chaosmesh-microservice

# Delete failed/pending pods only
kubectl delete pods --field-selector=status.phase!=Running

# To permanently stop all pods (keeps deployment for later)
kubectl scale deployment chaosmesh-microservice --replicas=0

# Scale pods up or down
kubectl scale deployment chaosmesh-microservice --replicas=3

# Restart all pods (rolling restart)
kubectl rollout restart deployment chaosmesh-microservice

# View pod logs
kubectl logs -l app=chaosmesh-microservice

# Describe a pod (for debugging)
kubectl describe pod -l app=chaosmesh-microservice
```

### Deployment Management

```bash
# Apply/update deployment
kubectl apply -f k8s/deployment.yaml

# Delete deployment and service
kubectl delete -f k8s/deployment.yaml

# Check deployment status
kubectl rollout status deployment chaosmesh-microservice
```

### Docker Image Management

```bash
# Build image locally
docker build -t chaosmesh-microservice .

# Build image directly in minikube (low memory)
minikube image build -t chaosmesh-microservice .

# Load local image into minikube
minikube image load chaosmesh-microservice

# List local Docker images
docker images | grep chaosmesh

# List minikube images
minikube image ls | grep chaosmesh

# Remove image from local Docker
docker rmi chaosmesh-microservice

# Remove image from minikube
minikube image rm docker.io/library/chaosmesh-microservice

# Remove all unused Docker images
docker image prune -f
```

### Full Cleanup (images + deployment)

```bash
# 1. Delete deployment and service
kubectl delete -f k8s/deployment.yaml

# 2. Verify pods are gone
kubectl get pods

# 3. Remove image from minikube
minikube image rm docker.io/library/chaosmesh-microservice

# 4. Remove image from local Docker
docker rmi chaosmesh-microservice

# 5. Verify
docker images | grep chaosmesh
minikube image ls | grep chaosmesh
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

- Minikube IP (default `192.168.49.2`) stays the same across stop/start cycles
- It changes if you run `minikube delete` + `minikube start`
- Check IP anytime: `minikube ip`
- Minikube needs at least 1800MB RAM available to Docker

### Switching Docker Context

Minikube runs its own Docker daemon. You can switch between local and minikube Docker:

```bash
# Switch to minikube's Docker
eval $(minikube docker-env)

# Switch back to local Docker
eval $(minikube docker-env -u)
```

To check which Docker environment you're currently using:

```bash
env | grep DOCKER
```

- If it shows `DOCKER_HOST`, `DOCKER_TLS_VERIFY`, etc. → you're on **minikube's Docker**
- If it shows nothing → you're on **local Docker**

Alternatively:

```bash
docker info | grep Name
```

- If it shows `minikube` → minikube's Docker
- If it shows your hostname (e.g. `ip-172-31-18-234`) → local Docker

> **Tip:** Build images on local Docker and load them into minikube with `minikube image load <image>`. This avoids needing to switch Docker context.
