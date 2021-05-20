#!/bin/bash

source ./define-functions.sh

export PRJROOT=/home/clay/ferguson/Quantizr
export SCRIPTS=${PRJROOT}/scripts

export SECRETS=/home/clay/ferguson/secrets
source ${SECRETS}/secrets.sh

export quanta_domain=localhost

# IMPORTANT: ***** You must set this to 'true' to regenerate the Java->TypeScript interfaces.
export CLEAN=true

export docker_compose_yaml=docker-compose-test.yaml
export mvn_profile=prod

# deploy target folder is where we will be running the app from
export DEPLOY_TARGET=/home/clay/ferguson/subnode-run
export ipfs_data=${DEPLOY_TARGET}/ipfs
export ipfs_staging=${DEPLOY_TARGET}/ipfs/staging

# Note: define-functions.sh is where we pass the ARGS into dockerfile
export JAR_FILE=./org.subnode-0.0.1-SNAPSHOT.jar
export PORT=8181
export PORT_DEBUG=8000
export XMS=512m
export XMX=2500m