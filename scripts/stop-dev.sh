#!/bin/bash

if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

# set -x

source ./setenv--localhost-dev.sh

 cd ${DEPLOY_TARGET}
dockerDown quanta-dev
dockerDown mongo-dev

# docker ps
sleep 3
