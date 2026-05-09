#!/bin/bash

# Exit on any error
set -e

# Change directory to the location of this script (project root)
cd "$(dirname "$0")"

echo "======================================================"
echo " Checking and installing missing packages via pnpm..."
echo "======================================================"
pnpm install

echo "======================================================"
echo " Starting all workspace services and apps..."
echo "======================================================"
# Run the root 'dev' command to start all services, gateway, and UI apps
pnpm run dev
