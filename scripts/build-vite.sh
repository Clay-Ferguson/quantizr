#!/bin/bash -i

# show commands as they are run.
# set -x
source ./setenv-dev.sh

cd ${PRJROOT}/src/main/resources/public
. ./build.sh

# Copy the dist folder to the target folder
rsync -aAX --delete --force "${PRJROOT}/src/main/resources/public/dist/" "${PRJROOT}/target/classes/public/dist/"
verifySuccess "Copied dist folder to target"
