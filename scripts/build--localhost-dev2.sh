#!/bin/bash
# see: https://quanta.wiki/n/localhost-fediverse-testing

# Only run this from build--localhost-build-multi.sh
# (i.e. do not run this script directly yourself)
#
# This script assumes 'build-localhost-dev.sh' (without the '2' ending) has just been run
# and we are doing a build of a multi-server setup (with two servers or more) probably for 
# doing Fediverse-feature testing. Most of the config files and folders simply have a '2' 
# appended to make them unique for the 'second' server, and the port numbers in these
# configs will be different, but everything else will be about the same.

if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

source ./setenv--localhost-dev2.sh

sudo mkdir -p ${MONGO_BASE}

# sudo chown 999:999 ${SECRETS}/mongod-dev2.conf

makeDirs
rm -f ${QUANTA_BASE}/log/*

cd ${PRJROOT}
dockerBuildUp quanta-dev2

# echo "quanta-dev IP"
# docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' quanta-dev2

# read -p "Build and Start Complete. press a key"
