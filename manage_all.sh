#!/bin/bash

# Variables to track last printed messages
last_sebo_msg=""
last_ui_msg=""
last_v3_msg=""

# Function to print message only if different from last
print_msg() {
  local last_msg_var=$1
  local new_msg=$2
  if [ "${!last_msg_var}" != "$new_msg" ]; then
    echo "$new_msg"
    eval "$last_msg_var=\"$new_msg\""
  fi
}

# Function to start sebo server only (no venv activation)
start_sebo() {
  print_msg last_sebo_msg "Starting sebo server..."
  (cd sebo && npm run dev) &
  print_msg last_sebo_msg "sebo server started."
}

# Function to stop sebo server
stop_sebo() {
  print_msg last_sebo_msg "Stopping sebo server..."
  pkill -f "node.*sebo"
  print_msg last_sebo_msg "sebo server stopped."
}

# Function to restart sebo server
restart_sebo() {
  stop_sebo
  start_sebo
}

# Function to start UI client
start_ui() {
  print_msg last_ui_msg "Starting UI client..."
  (cd UI/clients && npm run dev) &
  print_msg last_ui_msg "UI client started."
}

# Function to stop UI client
stop_ui() {
  print_msg last_ui_msg "Stopping UI client..."
  pkill -f "node.*UI/clients"
  print_msg last_ui_msg "UI client stopped."
}

# Function to restart UI client
restart_ui() {
  stop_ui
  start_ui
}

# Function to start V3 python script
start_v3() {
  print_msg last_v3_msg "Starting V3 python script..."
  # Run Python script directly in background without opening new terminal
  (cd V3 && python start_v3.py) &
  print_msg last_v3_msg "V3 started."
}

# Function to stop V3 python script
stop_v3() {
  print_msg last_v3_msg "Stopping V3 python script..."
  pkill -f "python.*V3/start_v3.py"
  print_msg last_v3_msg "V3 stopped."
}

# Function to restart V3 python script
restart_v3() {
  stop_v3
  start_v3
}

# Function to start all
start_all() {
  start_sebo
  start_ui
  start_v3
}

# Function to stop all
stop_all() {
  stop_sebo
  stop_ui
  stop_v3
}

# Function to restart all
restart_all() {
  stop_all
  start_all
}

# Main menu
echo "Select an option:"
echo "1) Start sebo"
echo "2) Stop sebo"
echo "3) Restart sebo"
echo "4) Start UI"
echo "5) Stop UI"
echo "6) Restart UI"
echo "7) Start V3"
echo "8) Stop V3"
echo "9) Restart V3"
echo "10) Start all"
echo "11) Stop all"
echo "12) Restart all"
echo "0) Exit"

read -p "Enter choice [0-12]: " choice

case $choice in
  1) start_sebo ;;
  2) stop_sebo ;;
  3) restart_sebo ;;
  4) start_ui ;;
  5) stop_ui ;;
  6) restart_ui ;;
  7) start_v3 ;;
  8) stop_v3 ;;
  9) restart_v3 ;;
  10) start_all ;;
  11) stop_all ;;
  12) restart_all ;;
  0) echo "Exiting." ; exit 0 ;;
  *) echo "Invalid option." ;;
esac

# Keep script running until user exits
while true; do
  echo ""
  echo "Select an option:"
  echo "1) Start sebo"
  echo "2) Stop sebo"
  echo "3) Restart sebo"
  echo "4) Start UI"
  echo "5) Stop UI"
  echo "6) Restart UI"
  echo "7) Start V3"
  echo "8) Stop V3"
  echo "9) Restart V3"
  echo "10) Start all"
  echo "11) Stop all"
  echo "12) Restart all"
  echo "0) Exit"

  read -p "Enter choice [0-12]: " choice

  case $choice in
    1) start_sebo ;;
    2) stop_sebo ;;
    3) restart_sebo ;;
    4) start_ui ;;
    5) stop_ui ;;
    6) restart_ui ;;
    7) start_v3 ;;
    8) stop_v3 ;;
    9) restart_v3 ;;
    10) start_all ;;
    11) stop_all ;;
    12) restart_all ;;
    0) echo "Exiting." ; exit 0 ;;
    *) echo "Invalid option." ;;
  esac
done
