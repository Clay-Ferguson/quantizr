#!/bin/bash

# *** IMPORTANT ***
#
# If you're running this before you've ever built the app you need to uncomment the
# install-node-and-npm and npm-install sections in the pom.xml so that NPM itself gets installed
# and all the packages get installed before your first run, then unless you add more dependencies
# without doing a manual 'npm install' yourself (from the correct folder!, with packages.json) you can
# keep those two POM sections permanently commented out so DEV builds run as fast as possible.
# 
# Script for doing a dev build for localhost testing of a single instance (no ActivityPub support)
###############################################################################
# This script is for normal localhost development. After running this script 
# you should have an instance running at http(s)://${quanta_domain}:${PORT}, for testing/debugging
###############################################################################

# Make the folder holding this script be the current working directory

clear
# show commands as they are run.
# set -x

# Make the folder holding this script become the current working directory
SCRIPT=$(readlink -f "$0")
SCRIPTPATH=$(dirname "$SCRIPT")
echo "cd $SCRIPTPATH"
cd "$SCRIPTPATH"

# Set all environment variables
source ./setenv-dev.sh

# I'm no longer forcing a gracefull shutdown this way, becasue I'm assuming Docker Swarm is graceful enough.
# echo "Stopping any existing server instance..."
# curl http://${quanta_domain}:${PORT}/mobile/api/shutdown?password=${adminPassword}

makeDirs
rm -rf ${QUANTA_BASE}/log/*

# Copy our primary logger file out to the live-loadable confured location
# (note: without the 'logging.config' being set in the docker yaml this file would
# load right from /src/mai/resouces which is the spring default location.)
cp ${PRJROOT}/src/main/resources/logback-spring.xml ${QUANTA_BASE}/log/logback.xml

cd ${PRJROOT}
# IMPORTANT: Use this to troubleshoot the variable substitutions in the yaml file
# docker-compose -f ${dc_yaml} config 
# read -p "Config look ok?"

# Take all the services offline
dockerDown

# Build the application from source
cd ${PRJROOT}
. ${SCRIPTS}/build.sh

genMongoConfig

# run docker compose build
cd ${PRJROOT}
dockerBuild
echo "Docker build complete..."

imageCheck ${DOCKER_TAG}
echo "Image is in repo: ${DOCKER_TAG}"

# Start the app
dockerUp

serviceCheck ${docker_stack}_quanta-dev
serviceCheck ${docker_stack}_mongo-dev

if [[ -z ${ipfsEnabled} ]];  
    then  
        echo "ipfs not in use"
    else
        serviceCheck ${docker_stack}_ipfs-dev
fi

# configure ipfs 
# todo-1: need to find out if there's a way to pass config parameters into the ipfs docker file or not, because that
# would be much cleaner than setting these parameters and then doing a restart
# Disabling this for now. Only needed to enable HTTP API over port 5001, and also needs to be run just once instead
# of every time we build.
# ipfsConfig ipfs-dev
# check ipfs again
# serviceCheck ipfs-dev

# read -p "Build and Start Complete. press a key"

echo "Waiting for server to initialize..."
sleep 7s

printUrlsMessage

