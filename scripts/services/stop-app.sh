#!/bin/bash

if [ -f /tmp/chaosmesh-app.pid ]; then
  PID=$(cat /tmp/chaosmesh-app.pid)
  if kill -0 $PID 2>/dev/null; then
    kill $PID
    rm -f /tmp/chaosmesh-app.pid
    echo "App stopped (PID: $PID)"
  else
    rm -f /tmp/chaosmesh-app.pid
    echo "App process not found, cleaned up stale PID file."
  fi
elif pgrep -f "port-forward.*chaosmesh-project" &> /dev/null; then
  pkill -f "port-forward.*chaosmesh-project"
  echo "App stopped."
else
  echo "App is not running."
fi
