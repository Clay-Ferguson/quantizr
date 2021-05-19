#!/bin/bash

if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

clear
# show commands as they are run.
# set -x

source ./setenv--localhost-dev.sh

# sudo chown 999:999 ${SECRETS}/mongod--localhost-dev.conf

makeDirs
rm -rf ${QUANTA_BASE}/log/*

dockerBuildUp

# read -p "Build and Start Complete. press a key"
