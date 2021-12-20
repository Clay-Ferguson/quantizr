#!/bin/bash

# force current dir to be this script
script_file=$(realpath $0)
script_folder="$(dirname "${script_file}")"
cd ${script_folder}

source ./setenv-distro-runner.sh

echo "Stopping any existing server instance..."
curl http://${quanta_domain}:${PORT}/mobile/api/shutdown?password=${adminPassword}

dockerDown quanta-distro
dockerDown mongo-distro

echo "All down."
sleep 2