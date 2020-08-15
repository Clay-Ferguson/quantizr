#!/bin/bash

export ipfs_data=/home/clay/.ipfs
export ipfs_staging=/home/clay/.ipfs/staging

source /home/clay/ferguson/secrets/secrets.sh

# Directory that contains the SubNode project (pom.xml is here, for example). This is the only
# hard-coded path, in the bash scripts
export PRJROOT=/home/clay/ferguson/Quantizr

export quanta_domain=localhost

# IMPORTANT: ***** You must set this to 'true' to regenerate the Java->TypeScript interfaces.
export CLEAN=true

export docker_compose_yaml=docker-compose-test.yaml
export mvn_profile=prod

# INSTANCE_FOLDER tells docker yaml volume where to find mongo-scripts folder and mongod.conf file.
export INSTANCE_FOLDER=/home/clay/quanta

# DATA_FOLDER tells docker yaml volume where to find mongo-dumps folder
export DATA_FOLDER=/home/clay/quanta-data
