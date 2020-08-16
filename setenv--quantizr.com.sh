#!/bin/bash

export ipfs_data=/home/clay/.ipfs
export ipfs_staging=/home/clay/.ipfs/staging

source ./setenv-common.sh

export quanta_domain=quantizr.com

# INSTANCE_FOLDER tells docker yaml volume where to find mongo-scripts folder and mongod.conf file.
export INSTANCE_FOLDER=/home/clay/quanta

# DATA_FOLDER tells docker yaml volume where to find mongo-dumps folder
export DATA_FOLDER=/home/clay/quanta-data

# IMPORTANT: ***** You must set this to 'true' to regenerate the Java->TypeScript interfaces.
export CLEAN=true

export docker_compose_yaml=docker-compose-prod.yaml

export mvn_profile=prod
