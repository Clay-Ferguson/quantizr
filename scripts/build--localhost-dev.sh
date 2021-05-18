#!/bin/bash
# Script for doing a dev build for localhost testing of a single instance (no ActivityPub support)

if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

###############################################################################
# This script is for normal localhost development. After running this script 
# you should have an instance running at http://localhost:8182, for testing/debugging
###############################################################################

clear
# show commands as they are run.
# set -x
source ./setenv--localhost-dev.sh

# sudo chown 999:999 ${SECRETS}/mongod--localhost-dev.conf

makeDirs
rm -f ${QUANTA_BASE}/log/*

cd ${PRJROOT}
. ${SCRIPTS}/_build.sh

# IMPORTANT: Use this to troubeshoot the variable substitutions in the yaml file
# docker-compose -f ${docker_compose_yaml} config 
# read -p "Config look ok?"

cd ${PRJROOT}
dockerBuildUp quanta-dev

# read -p "Build and Start Complete. press a key"
