#!/bin/bash
# see: https://quanta.wiki/n/localhost-fediverse-testing

# Configures build variables for secondary instance in
# a federated development enviroment.

source ./define-functions.sh
source ./define-functions-dev.sh

export PRJROOT=/home/clay/ferguson/Quantizr
export SCRIPTS=${PRJROOT}/scripts

export SECRETS=/home/clay/ferguson/secrets
source ${SECRETS}/secrets.sh

export ipfs_data=/home/clay/.ipfs2
export ipfs_staging=/home/clay/.ipfs2/staging

export quanta_domain=localhost

# Docker files are relative to project root
export docker_compose_yaml=docker-compose-dev2.yaml

export mvn_profile=dev

export JAR_FILE=target/org.subnode-0.0.1-SNAPSHOT.jar
export PORT=8183
export PORT_DEBUG=8001
export XMS=512m
export XMX=2500m

export MONGO_BASE=/home/clay/mongo2
export QUANTA_BASE=/home/clay/quanta-localhost-dev2
