#!/bin/bash
# see: https://quanta.wiki/n/localhost-fediverse-testing

###############################################################################
# This script is for normal localhost development. After running this script 
# you should have an instance running at http://localhost:8184, for testing/debugging
###############################################################################

clear
# show commands as they are run.
# set -x

source ./setenv-dev1.sh

makeDirs
rm -rf ${QUANTA_BASE}/log/*

cd ${PRJROOT}
dockerDown quanta-dev1
dockerDown mongo-dev1
# dockerDown ipfs-dev1

cd ${PRJROOT}
. ${SCRIPTS}/_build.sh

${SCRIPTS}/gen-mongod-conf-file.sh 

# IMPORTANT: Use this to troubeshoot the variable substitutions in the yaml file
# docker-compose -f ${docker_compose_yaml} config 
# read -p "Config look ok?"
cd ${PRJROOT}
dockerBuildUp

dockerCheck quanta-dev1
dockerCheck mongo-dev1
# dockerCheck ipfs-dev1

# echo "quanta-dev IP"
# docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' quanta-dev1

# read -p "Build and Start Complete. press a key"
