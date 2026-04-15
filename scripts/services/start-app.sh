#!/bin/bash

if pgrep -f "port-forward.*chaosmesh-project" &> /dev/null; then
  echo "App service is already running."
else
  echo "Starting app service on port 3000..."
  nohup kubectl port-forward --address 0.0.0.0 svc/chaosmesh-project 3000:80 > /tmp/chaosmesh-app.log 2>&1 &
  echo $! > /tmp/chaosmesh-app.pid
  echo "App started (PID: $!)"
  echo "Access at: http://<your-server-public-ip>:3000"
  echo "Logs at: /tmp/chaosmesh-app.log"
fi
