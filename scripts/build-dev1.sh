#!/bin/bash
# see: https://quanta.wiki/n/localhost-fediverse-testing

###############################################################################
# This script is for normal localhost development. After running this script 
# you should have an instance running at http://localhost:8184, for testing/debugging
###############################################################################

clear
# show commands as they are run.
# set -x

# force current dir to be this script
script_file=$(realpath $0)
script_folder="$(dirname "${script_file}")"
cd ${script_folder}

source ./setenv-dev1.sh

makeDirs
rm -rf ${QUANTA_BASE}/log/*

cd ${PRJROOT}
dockerDown ${dc_app_yaml} quanta-dev1
dockerDown ${dc_app_yaml} mongo-dev1
# dockerDown ${dc_app_yaml} ipfs-dev1

cd ${PRJROOT}
. ${SCRIPTS}/build.sh

${SCRIPTS}/gen-mongod-conf-file.sh 

# IMPORTANT: Use this to troubeshoot the variable substitutions in the yaml file
# docker-compose -f ${dc_app_yaml} config 
# read -p "Config look ok?"
cd ${PRJROOT}
dockerBuild
dockerUp

dockerCheck quanta-dev1
dockerCheck mongo-dev1
# dockerCheck ipfs-dev1

# echo "quanta-dev IP"
# docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' quanta-dev1

# read -p "Build and Start Complete. press a key"
