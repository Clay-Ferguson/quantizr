#!/bin/bash

clear
# show commands as they are run.
# set -x

cd $(dirname $(realpath $0))
source ./setenv-dev.sh

makeDirs
rm -rf ${QUANTA_BASE}/log/*

dockerBuild
dockerUp

# read -p "Build and Start Complete. press a key"
