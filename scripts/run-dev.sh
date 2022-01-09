#!/bin/bash

clear
# show commands as they are run.
# set -x

# force current dir to be this script
script_file=$(realpath $0)
script_folder="$(dirname "${script_file}")"
cd ${script_folder}

source ./setenv-dev.sh

makeDirs
rm -rf ${QUANTA_BASE}/log/*

dockerBuild
dockerUp

# read -p "Build and Start Complete. press a key"
