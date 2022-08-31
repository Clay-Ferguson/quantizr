#!/bin/bash

# show commands as they are run.
# set -x
source ./setenv-dev.sh

cd ${PRJROOT}
mvn -T 1C generate-resources -DskipTests -Pwebpack

# read -p "Build and Start Complete. press a key"
