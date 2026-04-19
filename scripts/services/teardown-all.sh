#!/bin/bash

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "Stopping port-forward (if running)..."
if [ -f /tmp/chaosmesh-app.pid ]; then
  kill "$(cat /tmp/chaosmesh-app.pid)" 2>/dev/null
  rm -f /tmp/chaosmesh-app.pid
fi
pkill -f "port-forward.*api-gateway" 2>/dev/null

echo ""
echo "Deleting chaos experiments..."
kubectl delete -f "$REPO_ROOT/chaos/" --ignore-not-found

echo ""
echo "Deleting app services..."
kubectl delete -f "$REPO_ROOT/k8s/api-gateway.yaml" --ignore-not-found
kubectl delete -f "$REPO_ROOT/k8s/user-service.yaml" --ignore-not-found
kubectl delete -f "$REPO_ROOT/k8s/order-service.yaml" --ignore-not-found
kubectl delete -f "$REPO_ROOT/k8s/inventory-service.yaml" --ignore-not-found

echo ""
echo "Deleting mongo-secret..."
kubectl delete secret mongo-secret --ignore-not-found

echo ""
echo "Deleting legacy deployment (if any)..."
kubectl delete deployment chaosmesh-microservice --ignore-not-found
kubectl delete service chaosmesh-microservice --ignore-not-found

echo ""
echo "Waiting for pods to terminate..."
kubectl wait --for=delete pod -l project=chaosmesh-microservice --timeout=60s 2>/dev/null

echo ""
kubectl get pods
kubectl get svc
echo ""
echo "Teardown complete."
