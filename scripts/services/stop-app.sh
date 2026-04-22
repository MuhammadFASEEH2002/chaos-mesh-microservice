#!/bin/bash

STOPPED=0

if [ -f /tmp/chaosmesh-app.pid ]; then
  PID=$(cat /tmp/chaosmesh-app.pid)
  if kill -0 $PID 2>/dev/null; then
    kill $PID 2>/dev/null
    STOPPED=1
  fi
  rm -f /tmp/chaosmesh-app.pid
fi

# Also kill the restart-loop wrapper and any lingering port-forward
pkill -f "chaosmesh-app-forward" 2>/dev/null && STOPPED=1
pkill -f "port-forward.*api-gateway" 2>/dev/null && STOPPED=1

if [ $STOPPED -eq 1 ]; then
  echo "App stopped."
else
  echo "App is not running."
fi
