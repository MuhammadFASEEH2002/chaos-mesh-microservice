#!/bin/bash

# install docker
if command -v docker &> /dev/null; then
  echo "Docker already installed, skipping..."
else
  echo "Installing Docker..."
  sudo yum update -y
  sudo yum install -y docker
  sudo systemctl start docker
  sudo systemctl enable docker
  sudo systemctl status docker
fi

# add current user to docker group (required for minikube)
if groups $USER | grep -q docker; then
  echo "User already in docker group, skipping..."
else
  echo "Adding user to docker group..."
  sudo usermod -aG docker $USER
  newgrp docker
fi

# install minikube
if command -v minikube &> /dev/null; then
  echo "Minikube already installed, skipping..."
else
  echo "Installing Minikube..."
  curl -LO https://github.com/kubernetes/minikube/releases/latest/download/minikube-linux-amd64
  sudo install minikube-linux-amd64 /usr/local/bin/minikube && rm minikube-linux-amd64
fi

# install kubectl
if command -v kubectl &> /dev/null; then
  echo "kubectl already installed, skipping..."
else
  echo "Installing kubectl..."
  curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
  sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
  kubectl version --client
fi

# adding alias for kubectl
alias kubectl="minikube kubectl --"

# install helm
if command -v helm &> /dev/null; then
  echo "Helm already installed, skipping..."
else
  echo "Installing Helm..."
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
  helm version
fi

# install chaos mesh from helm
if helm list -n chaos-mesh 2>/dev/null | grep -q chaos-mesh; then
  echo "Chaos Mesh already installed, skipping..."
else
  echo "Installing Chaos Mesh..."
  helm repo add chaos-mesh https://charts.chaos-mesh.org
  helm search repo chaos-mesh
  kubectl create ns chaos-mesh --dry-run=client -o yaml | kubectl apply -f -
  # Default to /var/run/docker.sock
  helm install chaos-mesh chaos-mesh/chaos-mesh -n=chaos-mesh --version 2.8.2
  kubectl get pods -n chaos-mesh -l app.kubernetes.io/instance=chaos-mesh
fi

echo "Setup complete!"
