#!/bin/bash -i

#---------------------------------------------------------------------
# This script is for normal localhost development. 
#
# After running this script you should have an instance running at
# http(s)://${quanta_domain}:${PORT}, for testing/debugging
#--------------------------------------------------------------------

clear
# show commands as they are run.
# set -x

# Set all environment variables
source ./setenv-dev.sh
checkFunctions

rm -rf ${QUANTA_BASE}/log/*

makeDirs

# Copy our primary logger file out to the live-loadable confured location
# (note: without the 'logging.config' being set in the docker yaml this file would
# load right from /src/mai/resouces which is the spring default location.)
cp ${PRJROOT}/src/main/resources/logback-spring.xml ${QUANTA_BASE}/log/logback.xml

cd ${PRJROOT}
dockerDown

# Build the application from source
cd ${PRJROOT}
. ${SCRIPTS}/build.sh

genMongoConfig

# IMPORTANT: Use this to troubleshoot the variable substitutions in the yaml file
# docker-compose -f ${dc_yaml} config > final-${dc_yaml}

# run docker compose build
cd ${PRJROOT}
dockerBuild
echo "Docker build complete..."

imageCheck ${DOCKER_IMAGE}
echo "Image is in repo: ${DOCKER_IMAGE}"

# Start the app
dockerUp

serviceCheck ${docker_stack}_quanta-dev
serviceCheck ${docker_stack}_mongo-dev

echo "Waiting 12s for server to initialize..."
sleep 12s

printUrlsMessage
