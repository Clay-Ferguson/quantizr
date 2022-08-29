#!/bin/bash

# show commands as they are run.
# set -x
source ./setenv-dev.sh

cd ${PRJROOT}
mvn generate-resources -DskipTests -Pwebpack

# read -p "Build and Start Complete. press a key"
