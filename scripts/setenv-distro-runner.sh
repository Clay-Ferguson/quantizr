#!/bin/bash

source ./define-functions.sh
source ./secrets.sh

export DEPLOY_TARGET=$PWD

export quanta_domain=localhost
export docker_compose_yaml=docker-compose-distro.yaml
export ipfs_data=${DEPLOY_TARGET}/ipfs
export ipfs_staging=${DEPLOY_TARGET}/ipfs/staging

export QUANTA_VER=1.0.4

export JAR_FILE=./org.subnode-0.0.1-SNAPSHOT.jar
export PORT=8185
export PORT_DEBUG=8000
export XMS=1000m
export XMX=2500m

export MONGO_DATA=${DEPLOY_TARGET}/data
export MONGO_HOST=mongo-distro
export MONGO_PORT=27020
export MONGOD_CONF=${DEPLOY_TARGET}/mongod.conf

# Allow extra propert setter file if exists to override any settings
if [ -f "./env-ext.sh" ]; then
    source ./env-ext.sh
fi
