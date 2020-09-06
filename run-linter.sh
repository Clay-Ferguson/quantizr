#!/bin/bash

source ./define-functions.sh
source ./setenv--localhost-dev.sh

cd ${PRJROOT}/src/main/resources/public

./node_modules/.bin/eslint ./**/*.ts


