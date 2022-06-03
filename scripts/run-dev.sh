#!/bin/bash

clear
# show commands as they are run.
# set -x

# Make the folder holding this script become the current working directory
SCRIPT=$(readlink -f "$0")
SCRIPTPATH=$(dirname "$SCRIPT")
echo "cd $SCRIPTPATH"
cd "$SCRIPTPATH"

source ./setenv-dev.sh

makeDirs
rm -rf ${QUANTA_BASE}/log/*

dockerBuild
dockerUp

# read -p "Build and Start Complete. press a key"
