#!/bin/bash
# set -x

# Make the folder holding this script become the current working directory
SCRIPT=$(readlink -f "$0")
SCRIPTPATH=$(dirname "$SCRIPT")
echo "cd $SCRIPTPATH"
cd "$SCRIPTPATH"

source ./setenv-dev.sh

cd ${PRJROOT}
dockerDown

# docker ps
sleep 3
