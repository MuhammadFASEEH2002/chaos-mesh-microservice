#!/bin/bash

if pgrep -f "chaosmesh-app-forward" &> /dev/null; then
  echo "App service is already running."
  exit 0
fi

echo "Starting API Gateway on port 3000 (auto-restart on pod failure)..."

nohup bash -c '
  # Marker so we can pgrep/kill the whole loop
  exec -a chaosmesh-app-forward bash -c "
    while true; do
      kubectl port-forward --address 0.0.0.0 svc/api-gateway 3000:80
      echo \"[$(date)] port-forward exited, restarting in 2s...\"
      sleep 2
    done
  "
' > /tmp/chaosmesh-app.log 2>&1 &

echo $! > /tmp/chaosmesh-app.pid
echo "App started (PID: $!)"
echo "Access at: http://<your-server-public-ip>:3000"
echo "Logs at: /tmp/chaosmesh-app.log"
