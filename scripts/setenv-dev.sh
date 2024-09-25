#!/bin/bash

FILE=$(readlink -f "$BASH_SOURCE")
FOLDER=$(dirname "$FILE")

export PRJROOT=$(dirname "$FOLDER")
export PRJPARENT=$(dirname "$PRJROOT")

source ./set-version.sh

# Defines some reusable functions that are common to many of these scripts
source ./define-functions.sh

# Define some functions that are specific only to managing the DEV environment
source ./define-functions-dev.sh

export VITE_SCRIPT=vite-build
export DOCKER_IMAGE=quanta-dev
export QAI_IMAGE=qai-dev

# Must be the folder where the Quantizr project is located. The root of the source folders.
export SCRIPTS=${PRJROOT}/scripts

export DOCKER_NETWORK=bridge

# If you're using a DNS name that should go here instead of the ip.
# This is the domain name as your BROWSER sees it.
# The 172.17.0.1 value is the default gateway docker creates for it's 'bridge' network, which I *think* is constant.
# but can be verified by running `docker network inspect bridge`.
export quanta_domain=172.17.0.1

# Docker files are relative to project root. We hold these in variables so that none of the scripts have them hardcoded
export dc_yaml=dc-dev.yaml
export docker_stack=quanta-stack-dev

export DOCKER_ENV=dev

# When we run Maven builder, this selects our profile.
export mvn_profile=dev

# Configue the application ports
export HOST_PORT=8182
export PORT=8182
export PORT_DEBUG=8000

# Configure memory allocations
export XMS=512m
export XMX=2g

# Configure MongoDB-specific variables
export MONGO_HOST=mongo-host-dev
export MONGO_PORT=27016

export QAI_HOST=qai-host-dev
export QAI_PORT=8186

# NOTE: This file gets *generated* by the build.
export MONGOD_CONF=${PRJROOT}/mongod-dev.conf
export MONGO_KEY=${PRJPARENT}/secrets/mongo-key-dev
export INIT_REPLICA=${PRJPARENT}/secrets/init-replica-dev.sh

# Sets a base location for MongoDB
export MONGO_DATA=${PRJPARENT}/dev-vols/mongodb
export MONGO_BACKUP=${PRJPARENT}/dev-vols/mongodb-dev-backup

export PGADMIN_DATA=${PRJPARENT}/dev-vols/pgadmin
export POSTGRES_DATA=${PRJPARENT}/dev-vols/postgres

export POSTGRES_PORT=5433
export PGADMIN_PORT=5051

# This tells our scripts where we are actually running from 
# (The Distro Folder on this machine. The folder containing the runtime and configs)
export QUANTA_BASE=/home/clay/quanta-localhost-dev

export DOCKER_DOWN_DELAY=30s
export DOCKER_UP_DELAY=30s

# SECRETS 

# Fill these in if you are supporting signups which requires you to have access
# to an email server, but won't be required if you're running your peer as a single
# user instance, or just doing localhost p2p testing/development.
export emailPassword=

export REDIS_HOST=redis-host-dev
export REDIS_PORT=6378
export REDIS_PASSWORD=password

# Warning: To be able to create our test accounts we need this email prop defined even
# even if it's a dummy string
export devEmail=somebody@someserver.com

# admin password: login to web app with "admin/password" credentials. Note also that
# this password is used in the yaml as the root password for MongoDB.
export adminPassword=password
export mongoPassword=password
export pgPassword=password

export pgAdminPassword=password
export pgAdminEmail=user@domain.com

# This is the password that will be used by the auto-generated test accounts you'll see 
# in the docker yaml for accounts adam, bob, cory, etc.
export testPassword=password

# OVERRIDE SECRETS IN here....

# If this additional variable setter file exists we run it, so it can 
# be used to override any of these settings
if [ -f "${PRJPARENT}/secrets/setenv-quanta-ext.sh" ]; then
    echo "Overriding Secrets with: ${PRJPARENT}/secrets/setenv-quanta-ext.sh"
    source ${PRJPARENT}/secrets/setenv-quanta-ext.sh
else 
    echo "Environment Override didn't exist: ${PRJPARENT}/secrets/setenv-quanta-ext.sh"
    read -p "Press ENTER to run with default secrets."
fi
