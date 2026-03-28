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
├── install_docker_minikube.sh
├── install_docker_minikube_amazon_linux.sh
├── uninstall_docker_minikube.sh
├── uninstall_docker_minikube_amazon_linux.sh
├── k8s/
│   └── deployment.yaml
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
chmod +x install_docker_minikube.sh
./install_docker_minikube.sh
```

**Amazon Linux:**
```bash
chmod +x install_docker_minikube_amazon_linux.sh
./install_docker_minikube_amazon_linux.sh
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
docker build -t chaosmesh-project:v1 .

# Load the image into minikube
minikube image load chaosmesh-project:v1

# Deploy to Kubernetes
kubectl apply -f k8s/deployment.yaml
```

> **Important:** Do NOT build inside minikube's Docker (`eval $(minikube docker-env)`) — it causes version mismatch errors. Always build on local Docker and use `minikube image load` to transfer the image.

**Low memory alternative:** If `minikube image load` gets killed (OOM), build directly inside minikube instead:

```bash
minikube image build -t chaosmesh-project:v1 .
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
kubectl port-forward --address 0.0.0.0 svc/chaosmesh-project 3000:80
```

Then open: `http://<server-public-ip>:3000/health`

## API Endpoints

| Method | Endpoint       | Description                  |
|--------|----------------|------------------------------|
| GET    | `/health`      | Health check with timestamp  |
| GET    | `/api/message` | Returns a status message     |

## Chaos Mesh Dashboard

### Access the dashboard

```bash
kubectl port-forward --address 0.0.0.0 svc/chaos-dashboard 2333:2333 -n chaos-mesh
```

Open: `http://<server-public-ip>:2333`

### Get login token

```bash
kubectl create token chaos-dashboard -n chaos-mesh
```

Copy the token and paste it on the dashboard login page.

## Kubernetes Configuration

- **Deployment**: 2 replicas of the Node.js app
- **Service**: NodePort type, exposed on port 30000
- **Health checks**: Liveness and readiness probes on `/health`
- **Container port**: 3000

## Delete Docker Image and Deployments

### 1. Delete the Kubernetes deployment and service

```bash
kubectl delete -f k8s/deployment.yaml
```

### 2. Verify pods are gone

```bash
kubectl get pods
```

### 3. Remove the image from minikube

```bash
minikube image rm docker.io/library/chaosmesh-project:v1
```

### 4. Remove the image from local Docker

```bash
docker rmi chaosmesh-project:v1
```

### 5. Verify images are removed

```bash
# Check local Docker
docker images | grep chaosmesh

# Check minikube
minikube image ls | grep chaosmesh
```

## Uninstall

**Ubuntu:**
```bash
chmod +x uninstall_docker_minikube.sh
./uninstall_docker_minikube.sh
```

**Amazon Linux:**
```bash
chmod +x uninstall_docker_minikube_amazon_linux.sh
./uninstall_docker_minikube_amazon_linux.sh
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

To verify which Docker you're pointing to:

```bash
docker info | grep Name
```

- If it shows `minikube` → you're on minikube's Docker
- If it shows your hostname (e.g. `ip-172-31-18-234`) → you're on local Docker

> **Tip:** Build images on local Docker and load them into minikube with `minikube image load <image>`. This avoids needing to switch Docker context.
