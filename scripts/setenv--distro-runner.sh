#!/bin/bash

source ./define-functions.sh
source ./secrets.sh

export DEPLOY_TARGET=$PWD
export quanta_domain=localhost
export docker_compose_yaml=docker-compose-distro.yaml
export ipfs_data=${DEPLOY_TARGET}/ipfs
export ipfs_staging=${DEPLOY_TARGET}/ipfs/staging

export QUANTA_VER=1.0.4
export PORT=8185
export PORT_DEBUG=8000
export XMS=1000m
export XMX=2500m

export MONGO_HOST=mongo-distro
export MONGO_PORT=27020
