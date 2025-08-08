#!/bin/bash
# Activate Python virtual environment
source simo/v1/venv/Scripts/activate

# Run backend server
(cd sebo/src/server && npm run dev) &

# Run frontend client
(cd UI/clients && npm run dev) &

# Run V3 python script with hot-reloading
python V3/run_dev.py
