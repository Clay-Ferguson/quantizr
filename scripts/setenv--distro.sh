#!/bin/bash

source ./define-functions.sh

export PRJROOT=/home/clay/ferguson/Quantizr
export SCRIPTS=${PRJROOT}/scripts

export SECRETS=${PRJROOT}/secrets
source ${SECRETS}/secrets.sh

export quanta_domain=localhost

# IMPORTANT: ***** You must set this to 'true' to regenerate the Java->TypeScript interfaces.
export CLEAN=true

export docker_compose_yaml=docker-compose-distro.yaml
export mvn_profile=prod

# deploy target folder is where we will be running the app from or what will become the ZIP file content
export DEPLOY_TARGET=/home/clay/ferguson/quanta-distro
mkdir -p ${DEPLOY_TARGET}

export ipfs_data=${DEPLOY_TARGET}/ipfs
export ipfs_staging=${DEPLOY_TARGET}/ipfs/staging

export QUANTA_VER=1.0.3

# Note: define-functions.sh is where we pass the ARGS into dockerfile
export JAR_FILE=./org.subnode-0.0.1-SNAPSHOT.jar
export PORT=8185
export PORT_DEBUG=8000
export XMS=513m
export XMX=3g