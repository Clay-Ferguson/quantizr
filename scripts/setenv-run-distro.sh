#!/bin/bash

source ./define-functions.sh

export QUANTA_VER=2.8.27t
export DOCKER_TAG=quanta-${QUANTA_VER}

# Uncomment either option 1 or option 2
# ================================================================
# OPTION 1) To pull from Docker Hub
#
# export DOCKER_IMAGE=subnode/repo:quanta-${QUANTA_VER}
# export JAR_FILE=
# ----------------------------------------------------------------
# OPTION 2) To Build Image from a local JAR
#
#    Having this JAR_FILE exist in the current folder will trigger a full docker-compose build
#    and install the contents of thta into the DOCKER_IMAGE specified here.
export DOCKER_IMAGE=quanta-${QUANTA_VER}
export JAR_FILE=./quanta-0.0.1-SNAPSHOT.jar
# ================================================================

export DEPLOY_TARGET=$PWD

export DOCKER_NETWORK=quanta-net
export SUBNET=192.168.2.0/24
export GATEWAY=192.168.2.9

# If you're using a DNS name that should go here instead of the ip.
# This is the domain name as your BROWSER sees it.
export quanta_domain=${GATEWAY}

export dc_yaml=dc-distro.yaml
export docker_stack=quanta-stack-distro

export ipfs_data=${DEPLOY_TARGET}/ipfs
export ipfs_staging=${DEPLOY_TARGET}/ipfs/staging

# make this BLANK for disabled, and "true" for enabled. When enabling don't forget to add the
# dependency in the dockercompose YAML file to start IPFS deamon before the app starts
export ipfsEnabled=

export HOST_PORT=80
export PORT=80
export PORT_DEBUG=8000
export XMS=1000m
export XMX=2500m

export MONGO_DATA=${DEPLOY_TARGET}/data
export MONGO_SCRIPTS=${DEPLOY_TARGET}/scripts
export MONGOD_CONF=${DEPLOY_TARGET}/mongod.conf
export MONGO_HOST=mongo-host-distro
export MONGO_PORT=27020

# SECRETS 

# Fill these in if you are supporting signups which requires you to have access
# to an email server, but won't be required if you're running your peer as a single
# user instance, or just doing localhost p2p testing/development.
export emailPassword=

# Warning: To be able to create our test accounts we need this email prop defined even
# even if it's a dummy string
export devEmail=somebody@someserver.com

# admin password: login to web app with "admin/password" credentials. Note also that
# this password is used in the yaml as the root password for MongoDB.
export adminPassword=password

# This is the password that will be used by the auto-generated test accounts you'll see 
# in the docker yaml for accounts adam, bob, cory, etc.
export testPassword=password

# OVERRIDE SECRETS IN here....

# If this additional variable setter file exists we run it, so it can 
# be used to override any of these settings
if [ -f "../setenv-quanta-ext.sh" ]; then
    echo "Overriding secrets with ../setenv-quanta-ext.sh"
    source ../setenv-quanta-ext.sh
fi
