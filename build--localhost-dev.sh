#!/bin/bash
clear
# show commands as they are run.
# set -x
source ./define-functions.sh
source ./setenv--localhost-dev.sh

sudo rm -f /home/clay/quantizr-tmp/log/*
mkdir -p ${ipfs_staging}

cd ${PRJROOT}
. ./_build.sh

docker-compose -f ${docker_compose_yaml} up -d subnode-dev
verifySuccess "Docker Compose: up"

dockerCheck "subnode-dev"

# read -p "Build and Start Complete. press a key"
