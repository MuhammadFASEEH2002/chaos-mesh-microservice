#!/bin/bash

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

SERVICES="api-gateway order-service user-service inventory-service"

for svc in $SERVICES; do
  echo "Building $svc..."
  docker build -t $svc "$REPO_ROOT/services/$svc"
  if [ $? -ne 0 ]; then
    echo "Error: Failed to build $svc"
    exit 1
  fi

  echo "Loading $svc into minikube..."
  minikube image load $svc
  if [ $? -ne 0 ]; then
    echo "Warning: minikube image load failed for $svc, trying minikube image build..."
    minikube image build -t $svc "$REPO_ROOT/services/$svc"
  fi

  echo "$svc done."
  echo ""
done

echo "All images built and loaded."
