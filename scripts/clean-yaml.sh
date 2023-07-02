#!/bin/bash

FILE=$(readlink -f "$BASH_SOURCE")
FOLDER=$(dirname "$FILE")

cd ${FOLDER}/../src/main/resources/public
yarn cache clean
npm cache clean --force

cd ${FOLDER}/../src/main/resources/server
yarn cache clean
npm cache clean --force

# If the above `yarn cache clean` command fails with out ot memory error run this instead: 
#     rm -rf $(yarn cache dir)

read -p "done."

