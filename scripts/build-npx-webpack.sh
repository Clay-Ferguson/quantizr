#!/bin/bash

# NOTE: This will run webpack dev, but was an experiment and is not
# a part of our official build process.

# Make the folder holding this script become the current working directory
SCRIPT=$(readlink -f "$0")
SCRIPTPATH=$(dirname "$SCRIPT")
echo "cd $SCRIPTPATH"
cd "$SCRIPTPATH"

# show commands as they are run.
# set -x

source ./setenv-dev.sh

cd ${PRJROOT}/src/main/resources/public
npx webpack --config webpack.dev.js

# read -p "Build and Start Complete. press a key"
