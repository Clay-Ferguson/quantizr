#!/bin/bash

# force current dir to be this script
script_file=$(realpath $0)
script_folder="$(dirname "${script_file}")"
cd ${script_folder}

# show commands as they are run.
# set -x
source ./setenv-dev.sh

cd ${PRJROOT}/src/main/resources/public
. on-build-start.sh

cd ${PRJROOT}
mvn generate-resources -DskipTests -Pwebpack

# read -p "Build and Start Complete. press a key"
