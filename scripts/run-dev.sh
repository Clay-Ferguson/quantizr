#!/bin/bash

clear
# show commands as they are run.
# set -x

source ./setenv-dev.sh

makeDirs
rm -rf ${QUANTA_BASE}/log/*

dockerBuildUp

# read -p "Build and Start Complete. press a key"
