#!/bin/bash
# This file is the actual version of 'setenv-run-distro.sh' that's used for the Quanta.wiki production deployment
# and is provided here as an example of a prod config. This file should be deployed into the distro as 'setenv-run-distro.sh'
# which means it's renamed to that name when placed in deplyment folder.
source ./set-version.sh
source ./define-functions.sh

# To Run from DockerHub do this:
# export DOCKER_IMAGE=subnode/quanta:2.20.12

export DOCKER_IMAGE=quanta
export QAI_IMAGE=qai
export DEPLOY_TARGET=$PWD
export DOCKER_NETWORK=bridge
export DATA_FOLDER=/home/clay/q2-data

# If you're using a DNS name that should go here instead of the ip.
# This is the domain name as your BROWSER sees it.
export quanta_domain=quanta.wiki

# I'm expanding scope of setenv to have the responsibility of ALSO creating folders
mkdir -pv ${DATA_FOLDER}/docs
mkdir -pv ${DATA_FOLDER}/tmp
mkdir -pv ${DATA_FOLDER}/log
mkdir -pv ${DEPLOY_TARGET}/config

export dc_yaml=dc-distro.yaml
export docker_stack=quanta-stack-distro

export HOST_PORT=80
export PORT=80

export HOST_PORT_SEC=443
export PORT_SEC=443

export PORT_DEBUG=8000
export XMS=2g
export XMX=4g

export MONGO_DATA=/var/lib/mongodb
export MONGOD_CONF=${DEPLOY_TARGET}/mongod.conf

# we dump this key into the root, and will not use it, but in real environments you'll put this key in some secure location
export MONGO_KEY=/mongo-key-distro

export INIT_REPLICA=${DEPLOY_TARGET}/init-replica-distro.sh
export MONGO_BACKUP=${DEPLOY_TARGET}/backup
export MONGO_HOST=mongo-host-distro
export MONGO_PORT=27017

export QAI_HOST=qai-host-distro
export QAI_PORT=8187

export POSTGRES_DATA=${DEPLOY_TARGET}/postgres
export PGADMIN_DATA=${DEPLOY_TARGET}/pgadmin
export PGADMIN_PORT=5050

export REDIS_HOST=redis-host-distro
export REDIS_PORT=6379
export REDIS_PASSWORD=

export DOCKER_DOWN_DELAY=30s
export DOCKER_UP_DELAY=30s

# SECRETS come out of the setenv-quanta-ext.sh (real passwords, etc)

# first apply any overrides that exist in this folder
if [ -f "setenv-quanta-ext.sh" ]; then
    echo "Overriding secrets with setenv-quanta-ext.sh"
    source setenv-quanta-ext.sh
fi

# then apply any overrides from parent folder
if [ -f "../setenv-quanta-ext.sh" ]; then
    echo "Overriding secrets with ../setenv-quanta-ext.sh"
    source ../setenv-quanta-ext.sh
fi
