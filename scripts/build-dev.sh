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

# To remove the mongo data and start fresh, uncomment the following lines. This is helpful especially when
# troubleshooting or verifying the automatic init-replica.sh script running.
# sudo rm -r ${MONGO_DATA}
# mkdir ${MONGO_DATA}

# Build the application from source
cd ${PRJROOT}
. ${SCRIPTS}/build.sh

genInitReplica
makeMongoKeyFile
genMongoConfig

# IMPORTANT: Use this to troubleshoot the variable substitutions in the yaml file
# docker-compose -f ${dc_yaml} config > final-${dc_yaml}

# run docker compose build
cd ${PRJROOT}
dockerBuild
echo "Docker build complete..."

imageCheck ${DOCKER_IMAGE}
echo "Image is in repo: ${DOCKER_IMAGE}"

imageCheck ${QAI_IMAGE}
echo "Image is in repo: ${QAI_IMAGE}"


# Uncomment this to see the final docker-compose file
# docker-compose -f ${dc_yaml} config > final-${dc_yaml}

# Start the app
dockerUp

serviceCheck ${docker_stack}_quanta-dev
serviceCheck ${docker_stack}_mongo-dev

# only required to run once to initialize the replica set
# runInitReplica

echo "Waiting 30s for server to initialize..."
sleep 30s

printUrlsMessage
