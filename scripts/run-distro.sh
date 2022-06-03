#!/bin/bash

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

source ./setenv-distro-runner.sh

./stop-distro.sh

# take ownership of this directory as current user
sudo chown -R $USER .

echo "removing logs"
rm -rf ./log/archived/*
rm -rf ./log/*.log

# Uncomment this to troubeshoot the variable substitutions in the yaml file, and will
# display a copy of the yaml file after all environment variables have been substituted/evaluated
# docker-compose -f ${dc_app_yaml} config
# read -p "Config look ok?"

./gen-mongod-conf-file.sh 

docker-compose -v

# If we detect that the springboot fat jar (the executable) exists in this folder then we run
# the dockerBuild function which does a docker-compose 'build' to create the image we will actually run USING the JAR
# file executable.
# This 'build' step will reference the `dockerfile` which is where the JAR_FILE is actually copied into the
# image. Once this is done our 'dockerUp' function will be able to start the actual server.
if [ -f "${JAR_FILE}" ]; then
    echo "Installing JAR file: ${JAR_FILE}"
    dockerBuild
fi
dockerUp

dockerCheck quanta-distro
dockerCheck mongo-distro

if [[ -z ${use_ipfs} ]];  
    then  
        echo "ipfs not in use"
    else
        dockerCheck ipfs-distro
fi

# docker-compose -f ${dc_app_yaml} logs --tail="all" quanta-distro

echo ================================================
echo Quanta Started OK!
echo http://${quanta_domain}:${PORT}
echo To Test: curl -X POST  http://${quanta_domain}:${PORT}/mobile/api/ping -H "Accept: application/json" -H "Content-Type: application/json" -d "{}"
echo ================================================
read -p "Press any key."

# If we detected the JAR_FILE above, and ran the dockerBuild step, then we don't need to do it again
# the next time we run because the docker image will already exist, and not need to be rebuild, so
# we rename the JAR_FILE so it won't cause another build, on next run.
if [ -f "${JAR_FILE}" ]; then
    mv ${JAR_FILE} ${JAR_FILE}.bak
fi
