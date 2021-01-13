#!/bin/bash

if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

source ./define-functions.sh
source ./setenv-common.sh
source ./setenv--localhost-dev.sh

cd ${PRJROOT}/src/main/resources/public

# ./node_modules/.bin/eslint --debug ./**/*.ts 

./node_modules/.bin/eslint . --ext .ts 

# add this param to the end to auto-fix
# --fix

verifySuccess "Linter"
