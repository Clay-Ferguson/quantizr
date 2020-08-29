#!/bin/bash

export ipfs_data=/home/clay/.ipfs
export ipfs_staging=/home/clay/.ipfs/staging

source ./setenv-common.sh

export quanta_domain=localhost

# IMPORTANT: ***** You must set this to 'true' to regenerate the Java->TypeScript interfaces.
export CLEAN=true

export docker_compose_yaml=docker-compose-test.yaml
export mvn_profile=prod

# INSTANCE_FOLDER tells docker yaml volume where to find mongo-scripts folder and mongod.conf file.
export INSTANCE_FOLDER=/home/clay/quanta

# deploy target folder is where we will be running the app from
export DEPLOY_TARGET=/home/clay/ferguson/subnode-run