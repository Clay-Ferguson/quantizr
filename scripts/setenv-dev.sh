#!/bin/bash

source ./define-functions.sh
source ./define-functions-dev.sh

export PRJROOT=/home/clay/ferguson/Quantizr
export SCRIPTS=${PRJROOT}/scripts

export SECRETS=/home/clay/ferguson/secrets
source ${SECRETS}/secrets.sh

export ipfs_data=/home/clay/.ipfs
export ipfs_staging=/home/clay/.ipfs/staging

export quanta_domain=localhost

# IMPORTANT: ***** You must set this to 'true' to regenerate the Java->TypeScript interfaces.
export CLEAN=true

# For more rapid development cycles you can set this to false once you know MONGO is up, and then
# this build script will just continue using that mongo without restarting it.
export RESTART_MONGO=false

# Docker files are relative to project root
# IMPORTANT: Either enable this ONE yaml line --OR-- the TWO just below it.
# 1) For MongoDB instance embedded in same yaml:
export docker_compose_yaml=docker-compose-dev.yaml
# 2) For MongoDB configured external to the app yaml
#export docker_compose_yaml=docker-compose-dev-nomongo.yaml
#export docker_compose_yaml_mongo=docker-compose-dev-mongo.yaml

# Not used: mongo is setup inside the docker-compose-dev.yaml for now
# export docker_compose_mongo_yaml=docker-compose-dev-mongo.yaml

export mvn_profile=dev

export JAR_FILE=target/org.subnode-0.0.1-SNAPSHOT.jar
export PORT=8182
export PORT_DEBUG=8000
export XMS=512m
export XMX=4g

export MONGO_HOST=mongo-dev
export MONGO_PORT=27016
export MONGOD_CONF=${SECRETS}/mongod-dev.conf

export MONGO_BASE=/home/clay/ferguson
export QUANTA_BASE=/home/clay/quanta-localhost-dev
