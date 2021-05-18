#!/bin/bash

if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

source ./setenv--localhost-test.sh

 cd ${DEPLOY_TARGET}
dockerDown