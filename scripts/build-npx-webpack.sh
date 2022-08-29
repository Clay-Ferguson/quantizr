#!/bin/bash

# NOTE: This will run webpack dev, but was an experiment and is not
# a part of our official build process.

# show commands as they are run.
# set -x

source ./setenv-dev.sh

cd ${PRJROOT}/src/main/resources/public
npx webpack --config webpack.dev.js

# read -p "Build and Start Complete. press a key"
