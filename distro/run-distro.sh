#!/bin/bash

clear
# show commands as they are run.
set -x

# ===================================================================
# Starts the Quanta server at: http://${quanta_domain}:${PORT}
#
# The only prerequisite software to be installed before running this is
# docker and docker-compose
#
# Docker References: https://docs.docker.com/compose/install/
#
# ===================================================================

source ./setenv-run-distro.sh

./stop-distro.sh

if [ -f "quanta-${QUANTA_VER}.tar" ]; then
    docker load -i quanta-${QUANTA_VER}.tar
fi

if [ -f "qai-${QUANTA_VER}.tar" ]; then
    docker load -i qai-${QUANTA_VER}.tar
fi

# take ownership of this directory as current user
sudo chown -R $USER .

mkdir -p ./backup
mkdir -p ./tmp
mkdir -p ./log
mkdir -p ./config
mkdir -p ./data

sudo mkdir -p ${PGADMIN_DATA}
sudo chown -R 5050:5050 ${PGADMIN_DATA}

# Use this to troubeshoot the variable substitutions in the yaml file, and will
# display a copy of the yaml file after all environment variables have been substituted/evaluated
# WARNING: This will expose your passwords in the output file!
# docker-compose -f ${dc_yaml} config --no-cache > final-${dc_yaml}
docker-compose -f ${dc_yaml} config > final-${dc_yaml}

genInitReplica
makeMongoKeyFile
genMongoConfig

dockerUp

serviceCheck ${docker_stack}_quanta-distro
serviceCheck ${docker_stack}_mongo-distro

# only required to run once to initialize the replica set
# runInitReplica

printUrlsMessage
