#!/bin/bash

source ./set-version.sh
source ./define-functions.sh

# To Run from DockerHub do this:
# export DOCKER_IMAGE=subnode/quanta:2.20.12

export DOCKER_IMAGE=quanta
export QAI_IMAGE=qai

export DEPLOY_TARGET=$PWD

export DOCKER_NETWORK=bridge

# If you're using a DNS name that should go here instead of the ip.
# This is the domain name as your BROWSER sees it.
# The 172.17.0.1 value is the default gateway docker creates for it's 'bridge' network, which I *think* a constant.
#  but can be verified by running `docker network inspect bridge`.
export quanta_domain=172.17.0.1

export dc_yaml=dc-distro.yaml
export docker_stack=quanta-stack-distro

export HOST_PORT=80
export PORT=80
export PORT_DEBUG=8000
export XMS=1g
export XMX=2g

export MONGO_DATA=${DEPLOY_TARGET}/data
export MONGOD_CONF=${DEPLOY_TARGET}/mongod.conf

# we dump this key into the root, and will not use it, but in real environments you'll put this key in some secure location
export MONGO_KEY=/mongo-key-distro

export INIT_REPLICA=${DEPLOY_TARGET}/init-replica-distro.sh
export MONGO_BACKUP=${DEPLOY_TARGET}/backup

export POSTGRES_DATA=${DEPLOY_TARGET}/postgres
export PGADMIN_DATA=${DEPLOY_TARGET}/pgadmin

export MONGO_HOST=mongo-host-distro
export MONGO_PORT=27017

export QAI_HOST=qai-host-distro
export QAI_PORT=8187

export DOCKER_DOWN_DELAY=30s
export DOCKER_UP_DELAY=30s

# SECRETS 

# Fill these in if you are supporting signups which requires you to have access
# to an email server, but won't be required if you're running your peer as a single
# user instance, or just doing localhost p2p testing/development.
export emailPassword=

export REDIS_HOST=redis-host-distro
export REDIS_PORT=6379
export REDIS_PASSWORD=password

# Warning: To be able to create our test accounts we need this email prop defined even
# even if it's a dummy string
export devEmail=somebody@someserver.com

# admin password: login to web app with "admin/password" credentials. Note also that
# this password is used in the yaml as the root password for MongoDB.
export adminPassword=password
export mongoPassword=password
export pgPassword=password

export PGADMIN_PORT=5050
export pgAdminPassword=password
export pgAdminEmail=user@domain.com

# This is the password that will be used by the auto-generated test accounts you'll see 
# in the docker yaml for accounts adam, bob, cory, etc.
export testPassword=password

# OVERRIDE SECRETS IN here....

# If this additional variable setter file exists we run it, so it can 
# be used to override any of these settings

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
