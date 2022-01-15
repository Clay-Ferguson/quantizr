#!/bin/bash
# see: https://quanta.wiki/n/localhost-fediverse-testing

# Only run this from build-build-multi.sh
# (i.e. do not run this script directly yourself)
#
# This script assumes 'build-localhost-dev1.sh' has just been run
# and we are doing a build of a multi-server setup (with two servers or more) probably for 
# doing Fediverse-feature testing. Most of the config files and folders simply have a '2' 
# appended to make them unique for the 'second' server, and the port numbers in these
# configs will be different, but everything else will be about the same.

cd $(dirname $(realpath $0))
source ./setenv-dev2.sh

sudo mkdir -p ${MONGO_BASE}

makeDirs
rm -rf ${QUANTA_BASE}/log/*

cd ${PRJROOT}
dockerDown ${dc_app_yaml} quanta-dev2
dockerDown ${dc_app_yaml} mongo-dev2

${SCRIPTS}/gen-mongod-conf-file.sh

cd ${PRJROOT}
dockerBuild
dockerUp

dockerCheck quanta-dev2
dockerCheck mongo-dev2

# echo "quanta-dev IP"
# docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' quanta-dev2

# read -p "Build and Start Complete. press a key"
