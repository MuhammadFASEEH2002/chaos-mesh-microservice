#!/bin/bash

# uninstall chaos mesh
if helm list -n chaos-mesh 2>/dev/null | grep -q chaos-mesh; then
  echo "Uninstalling Chaos Mesh..."
  helm uninstall chaos-mesh -n chaos-mesh
  kubectl delete ns chaos-mesh
else
  echo "Chaos Mesh not installed, skipping..."
fi

# stop minikube
if minikube status | grep -q "Running"; then
  echo "Stopping Minikube..."
  minikube stop
  minikube delete
else
  echo "Minikube not running, skipping..."
fi

# uninstall helm
if command -v helm &> /dev/null; then
  echo "Uninstalling Helm..."
  sudo rm -f /usr/local/bin/helm
else
  echo "Helm not installed, skipping..."
fi

# uninstall kubectl
if command -v kubectl &> /dev/null; then
  echo "Uninstalling kubectl..."
  sudo rm -f /usr/local/bin/kubectl
else
  echo "kubectl not installed, skipping..."
fi

# uninstall minikube
if command -v minikube &> /dev/null; then
  echo "Uninstalling Minikube..."
  sudo rm -f /usr/local/bin/minikube
else
  echo "Minikube not installed, skipping..."
fi

# remove user from docker group
if groups $USER | grep -q docker; then
  echo "Removing user from docker group..."
  sudo gpasswd -d $USER docker
else
  echo "User not in docker group, skipping..."
fi

# uninstall docker
if command -v docker &> /dev/null; then
  echo "Uninstalling Docker..."
  sudo systemctl stop docker
  sudo yum remove -y docker
  sudo yum autoremove -y
else
  echo "Docker not installed, skipping..."
fi

echo "Uninstall complete!"
