#!/bin/bash
# see: https://quanta.wiki/n/localhost-fediverse-testing

# Configures build variables for first instance in
# a federated development enviroment.

source ./define-functions.sh
source ./define-functions-dev.sh

export PRJROOT=/home/clay/ferguson/Quantizr
export SCRIPTS=${PRJROOT}/scripts

export SECRETS=/home/clay/ferguson/secrets
source ${SECRETS}/secrets.sh

export ipfs_data=/home/clay/.ipfs1
export ipfs_staging=/home/clay/.ipfs1/staging

export quanta_domain=localhost

# Docker files are relative to project root
export docker_compose_yaml=docker-compose-dev1.yaml

export mvn_profile=dev

export JAR_FILE=target/quanta-0.0.1-SNAPSHOT.jar
export PORT=8184
export PORT_DEBUG=8000
export XMS=512m
export XMX=2g

export MONGO_HOST=localhost
export MONGO_PORT=27019
export MONGOD_CONF=${SECRETS}/mongod-dev1.conf

export MONGO_BASE=/home/clay/mongo1
export QUANTA_BASE=/home/clay/quanta-localhost-dev1
