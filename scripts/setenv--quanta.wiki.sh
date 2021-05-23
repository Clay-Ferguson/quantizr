#!/bin/bash

source ./define-functions.sh

export PRJROOT=/home/clay/ferguson/Quantizr
export SCRIPTS=${PRJROOT}/scripts

export quanta_domain=quanta.wiki

# INSTANCE_FOLDER tells docker yaml volume where to find mongo-scripts folder and mongod.conf file.
export INSTANCE_FOLDER=/home/clay/quanta

# DATA_FOLDER tells docker yaml volume where to find mongo-dumps folder
export DATA_FOLDER=/home/clay/quanta-data

# IMPORTANT: ***** You must set this to 'true' to regenerate the Java->TypeScript interfaces.
export CLEAN=true

# todo-1: to be consistent could rename this to DEPLOY_TARGET
export PROD_DEPLOYER_BASE=/home/clay/ferguson/scripts/linode

export docker_compose_yaml=docker-compose-prod.yaml

export mvn_profile=prod

# Note: define-functions.sh is where we pass the ARGS into dockerfile
export JAR_FILE=./org.subnode-0.0.1-SNAPSHOT.jar
export PORT=80
export PORT_SEC=443
export PORT_DEBUG=8000
export XMS=1g
export XMX=6g