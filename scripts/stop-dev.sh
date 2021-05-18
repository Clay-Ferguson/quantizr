#!/bin/bash

if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

# set -x

source ./setenv--localhost-dev.sh

 cd ${DEPLOY_TARGET}
dockerDown

# docker ps
sleep 3
