#!/bin/bash

if [ -f /tmp/chaos-dashboard.pid ]; then
  PID=$(cat /tmp/chaos-dashboard.pid)
  if kill -0 $PID 2>/dev/null; then
    kill $PID
    rm -f /tmp/chaos-dashboard.pid
    echo "Dashboard stopped (PID: $PID)"
  else
    rm -f /tmp/chaos-dashboard.pid
    echo "Dashboard process not found, cleaned up stale PID file."
  fi
elif pgrep -f "port-forward.*chaos-dashboard" &> /dev/null; then
  pkill -f "port-forward.*chaos-dashboard"
  echo "Dashboard stopped."
else
  echo "Dashboard is not running."
fi
