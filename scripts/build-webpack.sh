#!/bin/bash

# Make the folder holding this script become the current working directory
SCRIPT=$(readlink -f "$0")
SCRIPTPATH=$(dirname "$SCRIPT")
echo "cd $SCRIPTPATH"
cd "$SCRIPTPATH"

# show commands as they are run.
# set -x
source ./setenv-dev.sh

cd ${PRJROOT}
mvn generate-resources -DskipTests -Pwebpack

# read -p "Build and Start Complete. press a key"
