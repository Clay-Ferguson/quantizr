#!/bin/bash

# Defines some reusable functions that are common to many of these scripts
source ./define-functions.sh

# Define some functions that are specific only to managing the DEV environment
source ./define-functions-dev.sh

# Must be the folder where the Quantizr project (from Github) is located. The root of the source folders.
export PRJROOT=/home/clay/ferguson/Quantizr
export SCRIPTS=${PRJROOT}/scripts

# Don't worry about this if you don't know what it is. Point it to an empty folder at least, but do set it.
export MONGO_SCRIPTS=/home/clay/ferguson/scripts/mongo
mkdir -p ${MONGO_SCRIPTS}

# You need to create your own secrets.sh file with your own passwords and store it somewhere secure on your machine
# and then set these vars to point to that file. There's an example 'secrets.sh' in the source you can use to see
# what goes in this file
export SECRETS=/home/clay/ferguson/secrets
source ${SECRETS}/secrets.sh

# Configure some locations for IPFS-related runtime files
export ipfs_data=/home/clay/.ipfs
export ipfs_staging=/home/clay/.ipfs/staging
export ipfs_test_root=/home/clay/ipfs_test_root

# Configure the domain name your instance will be running on.
export quanta_domain=localhost

# IMPORTANT: ***** You must set this to 'true' to regenerate the Java->TypeScript interfaces.
export CLEAN=true

# If this string is defined it causes the build/run to deploy to the minikube environment insead of the host machine.
# Kubernetes is not yet working. Ignore this if you don't know what it is.
export TARGET_K8=

# Set this to empty string if you want to not start mongo for whatever reason.
export START_MONGO=true

# Docker files are relative to project root. We hold these in variables so that none of the scripts have them hardcoded
export dc_app_yaml=dc-dev-app.yaml
export dc_ipfs_yaml=dc-dev-ipfs.yaml
export dc_mongo_yaml=dc-dev-mongo.yaml

# When we run Maven builder, this selects our profile.
export mvn_profile=dev

# Tells our scripts where the actual executable code is expected to be found
export JAR_FILE=target/quanta-0.0.1-SNAPSHOT.jar

# Configue the application ports
export PORT=8182
export PORT_DEBUG=8000

# Configure memory allocations
export XMS=512m
export XMX=4g

# Configure MongoDB-spedific variables
export MONGO_HOST=mongo-dev
export MONGO_PORT=27016
export MONGOD_CONF=${SECRETS}/mongod-dev.conf

# Sets a base location for MongoDB
export MONGO_BASE=/home/clay/ferguson

# This tells our scripts where we are actually running from (The Distro Folder on this machine. The folder containing the runtime and configs)
export QUANTA_BASE=/home/clay/quanta-localhost-dev
