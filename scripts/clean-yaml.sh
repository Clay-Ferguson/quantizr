#!/bin/bash

THIS_FILE=$(readlink -f "$0")
THIS_FOLDER=$(dirname "$THIS_FILE")

cd ${THIS_FOLDER}/../src/main/resources/public
yarn cache clean
npm cache clean --force

cd ${THIS_FOLDER}/../src/main/resources/server
yarn cache clean
npm cache clean --force

# If the above `yarn cache clean` command fails with out ot memory error run this instead: 
#     rm -rf $(yarn cache dir)

read -p "done."

