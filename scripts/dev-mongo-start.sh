#!/bin/bash

# This file is not currently used: mongo is setup inside the docker-compose-dev.yaml for now

if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

clear
# show commands as they are run.
# set -x

source ./setenv--localhost-dev.sh

# sudo chown 999:999 ${SECRETS}/mongod--localhost-dev.conf

dockerBuildUp mongo-dev

read -p "Mongo start complete. press a key"
