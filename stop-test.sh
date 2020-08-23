#!/bin/bash

cd /home/clay/ferguson/subnode-run

source ./define-functions.sh
source ./setenv--localhost-test.sh

docker-compose -f ${docker_compose_yaml} down --remove-orphans
verifySuccess "Docker Compose: down"

# docker ps
sleep 3


