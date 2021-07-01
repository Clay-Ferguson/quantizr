#!/bin/bash
# set -x

# force current dir to be this script
script_file=$(realpath $0)
script_folder="$(dirname "${script_file}")"
cd ${script_folder}

source ./setenv-dev.sh

cd ${PRJROOT}
dockerDown quanta-dev
dockerDown mongo-dev

# docker ps
sleep 3
