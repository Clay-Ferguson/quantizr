#!/bin/bash

if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

###############################################################################
# This script can serve as an example of how to run any app tar file that's
# built by any of the builders and is specifically used by Quanta dev team to
# move a runner script into the deploy location 
#
# (see file `build--localhost-test.sh`)
###############################################################################

cd ${DEPLOY_TARGET}

source ./define-functions.sh
source ./setenv--localhost-test.sh

docker-compose -f ${docker_compose_yaml} down --remove-orphans
verifySuccess "Docker Compose: down"
