#!/bin/bash
# todo-0: fix paths

if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

cd /home/clay/ferguson/source ./setenv-common.sh

source ./define-functions.sh
source ./setenv-common.sh
source ./setenv--localhost-test.sh

docker-compose -f ${docker_compose_yaml} down --remove-orphans
verifySuccess "Docker Compose: down"

# docker ps
sleep 3


