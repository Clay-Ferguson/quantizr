#!/bin/bash

clear
# show commands as they are run.
# set -x
source ./define-functions.sh
source ./setenv--localhost-dev.sh

sudo chown 999:999 ../secrets/mongod--localhost-dev.conf

cd ${PRJROOT}
docker-compose -f ${docker_compose_mongo_yaml} up -d mongo-dev
verifySuccess "Docker Compose (Mongo): up"
dockerCheck "mongo-dev"

read -p "Mongo start complete. press a key"
