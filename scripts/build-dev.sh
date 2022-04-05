#!/bin/bash
# Script for doing a dev build for localhost testing of a single instance (no ActivityPub support)
###############################################################################
# This script is for normal localhost development. After running this script 
# you should have an instance running at http(s)://${quanta_domain}:${PORT}, for testing/debugging
###############################################################################

# change to folder this script file is in
cd $(dirname $(realpath $0))

# show commands as they are run.
# set -x
source ./setenv-dev.sh

if [[ -z ${TARGET_K8} ]];  
then  
    echo "Targeting host machine (not minikube)"
else
    echo "Targeting Minikube"
    # NOTE: This will cause the docker images to go into the 
    # minikube environment so that for example `docker images` will show the build
    # image only from inside minikube, and not on the actual host machine.
    eval $(minikube docker-env)
fi

echo "Stopping any existing server instance..."
curl http://${quanta_domain}:${PORT}/mobile/api/shutdown?password=${adminPassword}

makeDirs
rm -rf ${QUANTA_BASE}/log/*

# Copy our primary logger file out to the live-loadable confured location
# (note: without the 'logging.config' being set in the docker yaml this file would
# load right from /src/mai/resouces which is the spring default location.)
cp ${PRJROOT}/src/main/resources/logback-spring.xml ${QUANTA_BASE}/log/logback.xml

# Take all the services offline
cd ${PRJROOT}
dockerDown ${dc_app_yaml} quanta-dev

if [[ -z ${START_MONGO} ]];  
then  
    echo "Not stopping MongoDB"
else
    dockerDown ${dc_mongo_yaml} mongo-dev
fi

dockerDown ${dc_ipfs_yaml} ipfs-dev

cd ${PRJROOT}
. ${SCRIPTS}/build.sh

# IMPORTANT: Use this to troubeshoot the variable substitutions in the yaml file
# docker-compose -f ${dc_app_yaml} config 
# read -p "Config look ok?"

${SCRIPTS}/gen-mongod-conf-file.sh

cd ${PRJROOT}
dockerBuild

if [[ -z ${TARGET_K8} ]];  
then  
    echo "Docker build complete..."
else
    echo "For K8, we're done after docker build. Exiting script."
    exit 0
fi

dockerUp

dockerCheck quanta-dev

if [[ -z ${START_MONGO} ]];  
then  
    echo "Not checking MongoDB"
else
    dockerCheck mongo-dev
fi

dockerCheck ipfs-dev

# configure ipfs 
# todo-1: need to find out if there's a way to pass config parameters into the ipfs docker file or not, because that
# would be much cleaner than setting these parameters and then doing a restart
# Disabling this for now. Only needed to enable HTTP API over port 5001, and also needs to be run just once instead
# of every time we build.
# ipfsConfig ipfs-dev
# check ipfs again
# dockerCheck ipfs-dev

# read -p "Build and Start Complete. press a key"
