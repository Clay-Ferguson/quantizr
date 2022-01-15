#!/bin/bash

cd $(dirname $(realpath $0))
source ./setenv-distro-runner.sh

echo "Stopping any existing server instance..."
curl http://${quanta_domain}:${PORT}/mobile/api/shutdown?password=${adminPassword}

dockerDown ${dc_app_yaml} quanta-distro
dockerDown ${dc_app_yaml} mongo-distro

echo "All down."
sleep 2