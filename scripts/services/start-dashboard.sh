#!/bin/bash

if pgrep -f "port-forward.*chaos-dashboard" &> /dev/null; then
  echo "Chaos Mesh dashboard is already running."
else
  echo "Starting Chaos Mesh dashboard on port 2333..."
  nohup kubectl port-forward --address 0.0.0.0 svc/chaos-dashboard 2333:2333 -n chaos-mesh > /tmp/chaos-dashboard.log 2>&1 &
  echo $! > /tmp/chaos-dashboard.pid
  echo "Dashboard started (PID: $!)"
  echo "Access at: http://<your-server-public-ip>:2333"
  echo "Logs at: /tmp/chaos-dashboard.log"
fi
