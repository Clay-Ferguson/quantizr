#!/bin/bash

cd ${PRJROOT}/src/main/resources/public

# ./node_modules/.bin/eslint --debug ./**/*.ts 

./node_modules/.bin/eslint . --ext .ts 

# add this param to the end to auto-fix
# --fix

verifySuccess "Linter"
