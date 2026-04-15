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
eval $(minikube docker-env --unset)

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

```bash
# Pod management
kubectl get pods
kubectl logs -l app=chaosmesh-microservice
kubectl describe pod -l app=chaosmesh-microservice
kubectl rollout restart deployment chaosmesh-microservice

# Stop everything (stop port-forward first, then scale down)
./scripts/services/stop-app.sh
kubectl scale deployment chaosmesh-microservice --replicas=0

# Start everything (scale up first, wait for ready, then port-forward)
kubectl scale deployment chaosmesh-microservice --replicas=5
kubectl wait --for=condition=ready pod -l app=chaosmesh-microservice --timeout=60s
./scripts/services/start-app.sh

# Deployment management
kubectl apply -f k8s/deployment.yaml
kubectl delete -f k8s/deployment.yaml
kubectl rollout status deployment chaosmesh-microservice

# Docker image management
docker build -t chaosmesh-microservice .
minikube image load chaosmesh-microservice
minikube image build -t chaosmesh-microservice .    # low memory alternative
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
kubectl apply -f k8s/deployment.yaml
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
