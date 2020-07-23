#!/bin/bash
# This script is for starting the mongo container all by itself
# whenever we need to troubleshoot it.

clear
source ./setenv.sh
source ./define-functions.sh

source ${SECRET_SCRIPT}
cd $PRJROOT

docker-compose -f docker-compose-dev-mongo.yaml up -d
verifySuccess "Docker Compose: up"

if docker ps | grep mongo-dev; then
    echo "mongo-dev successfully started"
else
    echo "mongo-dev failed to start"
fi

sleep 10