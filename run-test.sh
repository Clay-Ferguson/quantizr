#!/bin/bash

###############################################################################
# This script can serve as an example of how to run any app tar file that's
# built by any of the builders and is specifically used by Quanta dev team to
# move a runner script into the deploy location 
#
# (see file `build--localhost-test.sh`)
###############################################################################

cd /home/clay/ferguson/subnode-run

source ./define-functions.sh
source ./setenv--localhost-test.sh

docker-compose -f ${docker_compose_yaml} down --remove-orphans
verifySuccess "Docker Compose: down"

sudo chown 999:999 ./mongod--localhost-test.conf

# sudo docker ps
# read -p "Verify no instances up. Press any key."

echo "removing logs"
rm -f ./log/*

docker load -i ./subnode-test.tar
verifySuccess "Docker Load subnode-test.tar"

# IMPORTANT: Use this to troubeshoot the variable substitutions in the yaml file
# docker-compose -f ${docker_compose_yaml} config
# read -p "Config look ok?"

docker-compose -f ${docker_compose_yaml} up -d subnode-test
verifySuccess "Docker Compose: up"

dockerCheck "subnode-test"

echo ==========================
echo Quantizr Started OK!
echo ==========================
echo "Sleeping 7s"
sleep 7
