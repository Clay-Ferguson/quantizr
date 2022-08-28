#!/bin/bash

clear
# show commands as they are run.
# set -x

# ===================================================================
# Starts the Quanta server at: http://${quanta_domain}:${PORT}
#
# The only prerequisite software to be installed before running this is
# docker and docker-compose
#
# Docker References: https://docs.docker.com/compose/install/
#
# ===================================================================

# Make the folder holding this script become the current working directory
SCRIPT=$(readlink -f "$0")
SCRIPTPATH=$(dirname "$SCRIPT")
echo "cd $SCRIPTPATH"
cd "$SCRIPTPATH"

source ./setenv-run-distro.sh

./stop-distro.sh

# take ownership of this directory as current user
sudo chown -R $USER .

echo "removing logs"
rm -rf ./log/archived/*
rm -rf ./log/*.log

mkdir -p ./dumps
mkdir -p ./tmp
mkdir -p ./log
mkdir -p ./config
mkdir -p ./data
mkdir -p ./scripts

# Uncomment this to troubeshoot the variable substitutions in the yaml file, and will
# display a copy of the yaml file after all environment variables have been substituted/evaluated
# docker-compose -f ${dc_yaml} config
# read -p "Config look ok?"

genMongoConfig

# If we detect that the springboot fat jar (the executable) exists in this folder then we run
# the dockerBuild function which does a docker-compose 'build' to update to a new docker image that contains
# this current latest jar file.
if [ -f "${JAR_FILE}" ]; 
    then
        echo "Building new Docker Image (${DOCKER_IMAGE}) based on JAR file: ${JAR_FILE}"
        dockerBuild
    else 
        echo "Running from IMAGE: ${DOCKER_IMAGE}"
fi
dockerUp

serviceCheck ${docker_stack}_quanta-distro
serviceCheck ${docker_stack}_mongo-distro

if [[ -z ${ipfsEnabled} ]];  
    then  
        echo "ipfs not in use"
    else
        serviceCheck ${docker_stack}_ipfs-distro
fi

# docker-compose -f ${dc_yaml} logs --tail="all" quanta-distro

printUrlsMessage

# If we detected the JAR_FILE above, and ran the dockerBuild step, then we don't need to do it again
# the next time we run because the docker image will already exist, and not need to be rebuild, so
# we rename the JAR_FILE so it won't cause another build, on next run.
# if [ -f "${JAR_FILE}" ]; then
#     mv ${JAR_FILE} ${JAR_FILE}.bak
# fi
