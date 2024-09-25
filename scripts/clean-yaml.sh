#!/bin/bash

FILE=$(readlink -f "$BASH_SOURCE")
FOLDER=$(dirname "$FILE")

cd ${FOLDER}/../src/main/resources/public
yarn cache clean

# If the above `yarn cache clean` command fails with out ot memory error run this instead: 
#     rm -rf $(yarn cache dir)

read -p "done."

