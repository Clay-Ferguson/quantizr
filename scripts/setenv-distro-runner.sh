#!/bin/bash

source ./define-functions.sh
source ./secrets.sh

export DEPLOY_TARGET=$PWD

export quanta_domain=localhost

export dc_app_yaml=dc-distro-app.yaml
export dc_ipfs_yaml=dc-distro-ipfs.yaml
export dc_mongo_yaml=dc-distro-mongo.yaml

export ipfs_data=${DEPLOY_TARGET}/ipfs
export ipfs_staging=${DEPLOY_TARGET}/ipfs/staging

# make this BLANK for disabled, and "true" for enabled. When enabling don't forget to add the
# dependency in the dockercompose YAML file to start IPFS deamon before the app starts
export ipfsEnabled=

export QUANTA_VER=2.0.0

export JAR_FILE=
export PORT=8185
export PORT_DEBUG=8000
export XMS=1000m
export XMX=2500m

export MONGO_DATA=${DEPLOY_TARGET}/data
export MONGO_HOST=mongo-distro
export MONGO_PORT=27020
export MONGOD_CONF=${DEPLOY_TARGET}/mongod.conf

# If this additional variable setter file exists we run it, so it can 
# be used to override any of these settings
if [ -f "../setenv-quanta-ext.sh" ]; then
    source ../setenv-quanta-ext.sh
fi
