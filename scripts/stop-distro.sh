#!/bin/bash

# change to folder this script file is in
cd $(dirname $(realpath $0))
source ./setenv-distro-runner.sh

echo "Stopping any existing server instance..."
curl http://${quanta_domain}:${PORT}/mobile/api/shutdown?password=${adminPassword}

dockerDown ${dc_app_yaml} quanta-distro
dockerDown ${dc_mongo_yaml} mongo-distro
dockerDown ${dc_ipfs_yaml} ipfs-distro

echo "All down."
sleep 2