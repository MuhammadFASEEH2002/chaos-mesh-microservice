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
  minikube image load $svc &
  LOAD_PID=$!

  for _ in $(seq 1 60); do
    if minikube image ls 2>/dev/null | grep -q "/$svc:"; then
      echo "$svc present in minikube."
      kill $LOAD_PID 2>/dev/null
      wait $LOAD_PID 2>/dev/null
      break
    fi
    sleep 2
  done

  if ! minikube image ls 2>/dev/null | grep -q "/$svc:"; then
    echo "Warning: $svc not present in minikube after 120s, trying minikube image build..."
    kill $LOAD_PID 2>/dev/null
    wait $LOAD_PID 2>/dev/null
    minikube image build -t $svc "$REPO_ROOT/services/$svc"
  fi

  echo "$svc done."
  echo ""
done

echo "All images built and loaded."
