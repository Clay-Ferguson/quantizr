#!/bin/bash
# Script for doing a dev build for localhost testing of a single instance (no ActivityPub support)
###############################################################################
# This script is for normal localhost development. After running this script 
# you should have an instance running at http://localhost:port, for testing/debugging
###############################################################################

# force current dir to be this script
script_file=$(realpath $0)
script_folder="$(dirname "${script_file}")"
cd ${script_folder}

# show commands as they are run.
# set -x
source ./setenv-dev.sh

makeDirs
rm -rf ${QUANTA_BASE}/log/*

# Take all the services offline
cd ${PRJROOT}
dockerDown quanta-dev

if [ "$RESTART_MONGO" == "true" ]; then
    dockerDown mongo-dev
fi
dockerDown ipfs-dev

cd ${PRJROOT}
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

# read -p "Build and Start Complete. press a key"
