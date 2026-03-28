#!/bin/bash

# install docker
if command -v docker &> /dev/null; then
  echo "Docker already installed, skipping..."
else
  echo "Installing Docker..."
  # Add Docker's official GPG key:
  sudo apt update
  sudo apt install -y ca-certificates curl
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc

  # Add the repository to Apt sources:
  sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF

  sudo apt update
  sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo systemctl start docker
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
  sudo apt-get install -y curl gpg apt-transport-https
  curl -fsSL https://packages.buildkite.com/helm-linux/helm-debian/gpgkey | gpg --dearmor | sudo tee /usr/share/keyrings/helm.gpg > /dev/null
  echo "deb [signed-by=/usr/share/keyrings/helm.gpg] https://packages.buildkite.com/helm-linux/helm-debian/any/ any main" | sudo tee /etc/apt/sources.list.d/helm-stable-debian.list
  sudo apt-get update
  sudo apt-get install -y helm
  helm version
fi

# start minikube (required before helm/kubectl can talk to the cluster)
if minikube status | grep -q "Running"; then
  echo "Minikube already running, skipping..."
else
  echo "Starting Minikube..."
  minikube start
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