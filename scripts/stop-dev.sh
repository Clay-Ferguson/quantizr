#!/bin/bash

if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

# set -x

source ./setenv--localhost-dev.sh

cd ${PRJROOT}
docker-compose -f ${docker_compose_yaml} down --remove-orphans
verifySuccess "Docker Compose: down"

# docker ps
sleep 3
