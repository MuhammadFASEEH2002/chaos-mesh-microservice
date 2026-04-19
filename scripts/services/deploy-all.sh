#!/bin/bash

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "Deploying MongoDB..."
kubectl apply -f "$REPO_ROOT/k8s/mongodb.yaml"
echo "Waiting for MongoDB to be ready..."
kubectl wait --for=condition=ready pod -l app=mongodb --timeout=120s

echo ""
echo "Deploying all services..."
kubectl apply -f "$REPO_ROOT/k8s/inventory-service.yaml"
kubectl apply -f "$REPO_ROOT/k8s/order-service.yaml"
kubectl apply -f "$REPO_ROOT/k8s/user-service.yaml"
kubectl apply -f "$REPO_ROOT/k8s/api-gateway.yaml"

echo ""
echo "Waiting for all pods to be ready..."
kubectl wait --for=condition=ready pod -l project=chaosmesh-microservice --timeout=120s

echo ""
kubectl get pods
kubectl get svc
echo ""
echo "All services deployed. Run ./scripts/services/start-app.sh to expose the gateway."
