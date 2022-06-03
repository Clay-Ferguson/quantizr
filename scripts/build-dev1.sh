#!/bin/bash
# see: https://quanta.wiki/n/localhost-fediverse-testing

###############################################################################
# This script is for normal localhost development. After running this script 
# you should have an instance running at http://localhost:8184, for testing/debugging
###############################################################################

clear
# show commands as they are run.
# set -x

# Make the folder holding this script become the current working directory
SCRIPT=$(readlink -f "$0")
SCRIPTPATH=$(dirname "$SCRIPT")
echo "cd $SCRIPTPATH"
cd "$SCRIPTPATH"

source ./setenv-dev1.sh

makeDirs
rm -rf ${QUANTA_BASE}/log/*
# Copy our primary logger file out to the live-loadable confured location
# (note: without the 'logging.config' being set in the docker yaml this file would
# load right from /src/mai/resouces which is the spring default location.)
cp ${PRJROOT}/src/main/resources/logback-spring.xml ${QUANTA_BASE}/log/logback.xml

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
