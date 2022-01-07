#!/bin/bash
# Script for doing a dev build for localhost testing of a single instance (no ActivityPub support)
###############################################################################
# This script is for normal localhost development. After running this script 
# you should have an instance running at http(s)://${quanta_domain}:${PORT}, for testing/debugging
###############################################################################

# force current dir to be this script
script_file=$(realpath $0)
script_folder="$(dirname "${script_file}")"
cd ${script_folder}

# show commands as they are run.
# set -x
source ./setenv-dev.sh

echo "Stopping any existing server instance..."
curl http://${quanta_domain}:${PORT}/mobile/api/shutdown?password=${adminPassword}

# I think when this curl returns, there's no need to wait. it's done.
# echo "waiting 30s for graceful shutdown."
# sleep 30s

makeDirs
rm -rf ${QUANTA_BASE}/log/*

# Take all the services offline
cd ${PRJROOT}
dockerDown ${docker_compose_yaml} quanta-dev
dockerDown ${docker_compose_mongo_yaml} mongo-dev
dockerDown ${docker_compose_ipfs_yaml} ipfs-dev

cd ${PRJROOT}
# eval $(minikube docker-env)
. ${SCRIPTS}/_build.sh

# IMPORTANT: Use this to troubeshoot the variable substitutions in the yaml file
# docker-compose -f ${docker_compose_yaml} config 
# read -p "Config look ok?"

${SCRIPTS}/gen-mongod-conf-file.sh

cd ${PRJROOT}
dockerBuildUp

dockerCheck quanta-dev
dockerCheck mongo-dev
dockerCheck ipfs-dev

# configure ipfs 
# todo-1: need to find out if there's a way to pass config parameters into the ipfs docker file or not, because that
# would be much cleaner than setting these parameters and then doing a restart
# Disabling this for now. Only needed to enable HTTP API over port 5001, and also needs to be run just once instead
# of every time we build.
# ipfsConfig ipfs-dev

# check ipfs again
dockerCheck ipfs-dev

# read -p "Build and Start Complete. press a key"
