#!/bin/bash
# Script for doing a dev build for localhost testing of a single instance (no ActivityPub support)
###############################################################################
# This script is for normal localhost development. After running this script 
# you should have an instance running at http://localhost:port, for testing/debugging
###############################################################################

# show commands as they are run.
# set -x
source ./setenv--localhost-dev.sh

./gen-mongod-conf-file.sh ${SECRETS}/mongod--localhost-dev.conf

makeDirs
rm -rf ${QUANTA_BASE}/log/*

cd ${PRJROOT}
dockerDown quanta-dev
dockerDown mongo-dev
dockerDown ipfs-dev

cd ${PRJROOT}
. ${SCRIPTS}/_build.sh

# IMPORTANT: Use this to troubeshoot the variable substitutions in the yaml file
# docker-compose -f ${docker_compose_yaml} config 
# read -p "Config look ok?"

cd ${PRJROOT}
dockerBuildUp

dockerCheck quanta-dev
dockerCheck mongo-dev
dockerCheck ipfs-dev

# read -p "Build and Start Complete. press a key"
