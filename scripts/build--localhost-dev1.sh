#!/bin/bash
# see: https://quanta.wiki/n/localhost-fediverse-testing

if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

###############################################################################
# This script is for normal localhost development. After running this script 
# you should have an instance running at http://localhost:8184, for testing/debugging
###############################################################################

clear
# show commands as they are run.
# set -x

source ./setenv--localhost-dev1.sh

# sudo chown 999:999 ${SECRETS}/mongod--localhost-dev1.conf

makeDirs
rm -f ${QUANTA_BASE}/log/*

cd ${PRJROOT}
. ${SCRIPTS}/_build.sh

# IMPORTANT: Use this to troubeshoot the variable substitutions in the yaml file
# docker-compose -f ${docker_compose_yaml} config 
# read -p "Config look ok?"
cd ${PRJROOT}
dockerBuildUp quanta-dev1

# echo "quanta-dev IP"
# docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' quanta-dev1

# read -p "Build and Start Complete. press a key"
