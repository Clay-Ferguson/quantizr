#!/bin/bash

source ./setenv--distro.sh

cd ${DEPLOY_TARGET}
docker-compose -f ${docker_compose_yaml} down --remove-orphans
verifySuccess "Docker Compose: down"
