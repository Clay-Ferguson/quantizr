#!/bin/bash

clear
# show commands as they are run.
# set -x

# change to folder this script file is in
cd $(dirname $(realpath $0))
source ./setenv-dev.sh

makeDirs
rm -rf ${QUANTA_BASE}/log/*

dockerBuild
dockerUp

# read -p "Build and Start Complete. press a key"
