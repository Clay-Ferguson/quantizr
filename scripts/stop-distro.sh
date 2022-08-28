#!/bin/bash

# Make the folder holding this script become the current working directory
SCRIPT=$(readlink -f "$0")
SCRIPTPATH=$(dirname "$SCRIPT")
echo "cd $SCRIPTPATH"
cd "$SCRIPTPATH"

source ./setenv-run-distro.sh

# echo "Stopping any existing server instance..."
# curl http://${quanta_domain}:${PORT}/mobile/api/shutdown?password=${adminPassword}

dockerDown

echo "All down."
sleep 2