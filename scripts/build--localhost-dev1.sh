#!/bin/bash
# see: https://quanta.wiki/n/localhost-fediverse-testing

if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

###############################################################################
# This script is for normal localhost development. After running this script 
# you should have an instance running at http://localhost:8182, for testing/debugging
#
# In this deploy no docker TAR image containing the deployment is ever
# generated, because everything's run 'in place' rather than generating a 
# deployment that can be moved to some other machine.
###############################################################################

clear
# show commands as they are run.
# set -x

source ./setenv--localhost-dev1.sh

sudo chown 999:999 ${SECRETS}/mongod--localhost-dev1.conf

sudo mkdir -p ${QUANTA_BASE}/log
sudo mkdir -p ${QUANTA_BASE}/tmp
sudo mkdir -p ${QUANTA_BASE}/config
sudo mkdir -p ${QUANTA_BASE}/lucene

sudo rm -f ${QUANTA_BASE}/log/*
mkdir -p ${ipfs_data}
mkdir -p ${ipfs_staging}

cd ${PRJROOT}
. ${SCRIPTS}/_build.sh

# This first docker call starts up the network and MongoDB
# We run mongo using a separate compose, just because we want it fully decoupled
# for preparation and testing getting ready for running the APP in a load balancer
cd ${PRJROOT}

# Not used: mongo is setup inside the docker-compose-dev.yaml for now
# docker-compose -f ${docker_compose_mongo_yaml} up -d mongo-dev
# verifySuccess "Docker Compose (Mongo): up"
# dockerCheck "mongo-dev"

docker-compose -f ${docker_compose_yaml} up -d quanta-dev1
verifySuccess "Docker Compose quanta-dev1: up"

# sleep 10
# echp "Sleeping 10 seconds before checking logs"
# docker-compose -f ${docker_compose_yaml} logs ipfs-dev1
# verifySuccess "Docker Compose: logs"

dockerCheck "quanta-dev1"

# echo "quanta-dev IP"
# docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' quanta-dev1

# read -p "Build and Start Complete. press a key"
