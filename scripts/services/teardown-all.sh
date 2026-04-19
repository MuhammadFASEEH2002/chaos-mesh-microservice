#!/bin/bash

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

delete_if_exists() {
  local kind="$1" name="$2"
  if kubectl get "$kind" "$name" --ignore-not-found -o name 2>/dev/null | grep -q .; then
    echo "Deleting $kind/$name..."
    kubectl delete "$kind" "$name" --ignore-not-found
  else
    echo "Skipping $kind/$name (not found)."
  fi
}

delete_manifest_if_exists() {
  local file="$1"
  if [ -f "$file" ]; then
    kubectl delete -f "$file" --ignore-not-found
  else
    echo "Skipping $(basename "$file") (file not found)."
  fi
}

echo "Stopping port-forward (if running)..."
if [ -f /tmp/chaosmesh-app.pid ]; then
  kill "$(cat /tmp/chaosmesh-app.pid)" 2>/dev/null
  rm -f /tmp/chaosmesh-app.pid
fi
pkill -f "port-forward.*api-gateway" 2>/dev/null

echo ""
if [ -d "$REPO_ROOT/chaos" ] && ls "$REPO_ROOT/chaos/"*.yaml >/dev/null 2>&1; then
  echo "Deleting chaos experiments..."
  kubectl delete -f "$REPO_ROOT/chaos/" --ignore-not-found
else
  echo "Skipping chaos experiments (no manifests found)."
fi

echo ""
echo "Deleting app services..."
delete_manifest_if_exists "$REPO_ROOT/k8s/api-gateway.yaml"
delete_manifest_if_exists "$REPO_ROOT/k8s/user-service.yaml"
delete_manifest_if_exists "$REPO_ROOT/k8s/order-service.yaml"
delete_manifest_if_exists "$REPO_ROOT/k8s/inventory-service.yaml"

echo ""
delete_if_exists secret mongo-secret

echo ""
echo "Checking for legacy deployment..."
delete_if_exists deployment chaosmesh-microservice
delete_if_exists service chaosmesh-microservice

echo ""
if kubectl get pod -l project=chaosmesh-microservice -o name 2>/dev/null | grep -q .; then
  echo "Waiting for pods to terminate..."
  kubectl wait --for=delete pod -l project=chaosmesh-microservice --timeout=60s 2>/dev/null
fi

echo ""
kubectl get pods
kubectl get svc
echo ""
echo "Teardown complete."
