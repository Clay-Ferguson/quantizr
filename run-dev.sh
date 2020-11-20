#!/bin/bash

###############################################################################
# This script is for normal localhost development. After running this script 
# you should have an instance running at http://localhost:8182
# In this deploy no docker TAR image containing the deployment is ever
# generated, because everything's run 'in place' rather than generating a 
# deployment that can be moved to some other machine.
###############################################################################

clear
# show commands as they are run.
# set -x
source ./define-functions.sh
source ./setenv--localhost-dev.sh

sudo chown 999:999 ../secrets/mongod--localhost-dev.conf

sudo mkdir -p ${QUANTA_BASE}/log
sudo mkdir -p ${QUANTA_BASE}/tmp
sudo mkdir -p ${QUANTA_BASE}/lucene

sudo rm -f ${QUANTA_BASE}/log/*
mkdir -p ${ipfs_staging}

cd ${PRJROOT}

docker-compose -f ${docker_compose_yaml} up -d subnode-dev
verifySuccess "Docker Compose: up"

dockerCheck "subnode-dev"

# read -p "Build and Start Complete. press a key"
