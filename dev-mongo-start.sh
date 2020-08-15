#!/bin/bash
# This script is for starting the mongo container all by itself
# whenever we need to troubleshoot it.

clear
source ./define-functions.sh

source /home/clay/ferguson/meta64Oak-private/secrets.sh
cd $PRJROOT

docker-compose -f docker-compose-dev-mongo.yaml up -d
verifySuccess "Docker Compose: up"

if docker ps | grep mongo-dev; then
    echo "mongo-dev successfully started"
else
    echo "mongo-dev failed to start"
fi

sleep 10