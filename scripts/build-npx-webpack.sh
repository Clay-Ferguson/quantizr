#!/bin/bash

# NOTE: This will run webpack dev, but was an experiment and is not
# a part of our official build process.

# force current dir to be this script
script_file=$(realpath $0)
script_folder="$(dirname "${script_file}")"
cd ${script_folder}

# show commands as they are run.
# set -x

source ./setenv-dev.sh

cd ${PRJROOT}/src/main/resources/public

# todo-0: Once we have SCSS compile being done by webpack, we can put a "build script" in the package.json which is more standard.
# and then we can compile with "npm run build" instead of npx

npx webpack --config webpack.dev.js

# read -p "Build and Start Complete. press a key"
