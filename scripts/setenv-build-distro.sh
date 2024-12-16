#!/bin/bash
# This is the version of the 'setenv' file that's used to build the distro. The file named
# 'setenv-run-distro.sh' is the environment setter for the runtime/deployment.

source ./set-version.sh
source ./define-functions.sh

FILE=$(readlink -f "$BASH_SOURCE")
FOLDER=$(dirname "$FILE")
export PRJROOT=$(dirname "$FOLDER")
export PRJPARENT=$(dirname "$PRJROOT")

export VITE_SCRIPT=vite-build

export DOCKER_IMAGE=quanta
export QAI_IMAGE=qai
export SCRIPTS=${PRJROOT}/scripts
export DOCKER_NETWORK=bridge

# If you're using a DNS name that should go here instead of the ip.
# This is the domain name as your BROWSER sees it.
# The 172.17.0.1 value is the default gateway docker creates for it's 'bridge' network, which I *think* a constant.
#  but can be verified by running `docker network inspect bridge`.
export quanta_domain=172.17.0.1

export dc_yaml=dc-distro.yaml
export docker_stack=quanta-stack-distro

export DOCKER_ENV=distro
export mvn_profile=prod

# deploy target folder is where we will be running the app from or what will become the ZIP file content
export DEPLOY_TARGET=/home/clay/distro
mkdir -p ${DEPLOY_TARGET}

# Note: define-functions.sh is where we pass the ARGS into dockerfile
export HOST_PORT=80
export PORT=80
export PORT_DEBUG=8000
export XMS=512m
export XMX=2g

export MONGO_DATA=${DEPLOY_TARGET}/data
export MONGO_BACKUP=${DEPLOY_TARGET}/backup
export MONGO_HOST=mongo-host-distro
export MONGO_PORT=27017
export MONGOD_CONF=${DEPLOY_TARGET}/mongod.conf

export QAI_HOST=qai-host-distro
export QAI_PORT=8187

# we dump this key into the root, and will not use it, but in real environments you'll put this key in some secure location
export MONGO_KEY=/mongo-key-distro

export INIT_REPLICA=${DEPLOY_TARGET}/init-replica-distro.sh

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

# This is the password that will be used by the auto-generated test accounts you'll see 
# in the docker yaml for accounts adam, bob, cory, etc.
export testPassword=password