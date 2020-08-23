#!/bin/bash

source ./define-functions.sh
source ./setenv--localhost-dev.sh

docker-compose -f ${docker_compose_yaml} down --remove-orphans
verifySuccess "Docker Compose: down"

# docker ps
sleep 3
