#!/bin/bash

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

append_db() {
  local base="$1" db="$2"
  if [[ "$base" == *"/?"* ]]; then
    echo "${base/\/\?/\/${db}?}"
  elif [[ "$base" == */ ]]; then
    echo "${base}${db}"
  else
    echo "${base}/${db}"
  fi
}

echo "Enter MongoDB Atlas base URI (input hidden)."
echo "Example: mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority"
read -r -s -p "URI: " MONGO_BASE_URI
echo ""

if [ -z "$MONGO_BASE_URI" ]; then
  echo "Error: URI cannot be empty."
  exit 1
fi

USER_URI=$(append_db "$MONGO_BASE_URI" "users")
ORDER_URI=$(append_db "$MONGO_BASE_URI" "orders")
INVENTORY_URI=$(append_db "$MONGO_BASE_URI" "inventory")

echo "Creating mongo-secret..."
kubectl create secret generic mongo-secret \
  --from-literal=user-uri="$USER_URI" \
  --from-literal=order-uri="$ORDER_URI" \
  --from-literal=inventory-uri="$INVENTORY_URI" \
  --dry-run=client -o yaml | kubectl apply -f -

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
