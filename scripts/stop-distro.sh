#!/bin/bash

# Make the folder holding this script become the current working directory
SCRIPT=$(readlink -f "$0")
SCRIPTPATH=$(dirname "$SCRIPT")
echo "cd $SCRIPTPATH"
cd "$SCRIPTPATH"

source ./setenv-distro-runner.sh

echo "Stopping any existing server instance..."
curl http://${quanta_domain}:${PORT}/mobile/api/shutdown?password=${adminPassword}

dockerDown ${dc_app_yaml} quanta-distro
dockerDown ${dc_mongo_yaml} mongo-distro
dockerDown ${dc_ipfs_yaml} ipfs-distro

echo "All down."
sleep 2