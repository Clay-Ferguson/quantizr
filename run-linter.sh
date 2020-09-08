#!/bin/bash

source ./define-functions.sh
source ./setenv--localhost-dev.sh

cd ${PRJROOT}/src/main/resources/public

# ./node_modules/.bin/eslint --debug ./**/*.ts 

./node_modules/.bin/eslint . --ext .ts

verifySuccess "Linter"
