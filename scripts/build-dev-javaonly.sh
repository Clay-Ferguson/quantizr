#!/bin/bash

# WARNING: Docker Swarm has issues with this. Sometimes it works 
# and sometimes it fails.

# This is the script to run if you have Quanta already deployed locally and have only chagned Java source
# and want to restart the Quanta web app container. Note that this only works because our DEV environment
# has the following volumes in the docker compose yaml:
# 
#  - '${PRJROOT}/src/main/resources/public:/dev-resource-base'
#  - '${PRJROOT}/target/classes:/loader-path'
#
# Note: The new java classes are loaded from 'loader-path', so just by restarting the deamon those go into effect

clear
# show commands as they are run.
# set -x

# Set all environment variables
source ./setenv-dev.sh
checkFunctions

# Build the application from source
cd ${PRJROOT}
mvn -T 1C package -DskipTests=true -P${mvn_profile}
verifySuccess "Maven Build"

dockerDown
# IMPORTANT
# This sleep is extremely imortant. You can see if you run 'docker ps' that even after scaling down to zero the
# replica is still 'running' so we have to wait here untl even 'dockerk ps' can confirm Quanta is indeed down, and
# for now I'm just doing a long enough wait, but depending on computer CPU load this sleep might not even be
# long enough
echo "Sleeping 5s for Docker Swarm stabilize" 
sleep 5s
sudo rm -rf ${QUANTA_BASE}/log/*
echo "Verifying Stopped"
# docker container ls --filter name=quanta-stack-dev_quanta-dev*
docker ps --filter name=quanta-stack-dev_quanta-dev*
echo "After 'Verifying Stopped' above, nothing should be showing"
dockerUp

serviceCheck ${docker_stack}_quanta-dev

echo "Waiting 20s for server to initialize..."
sleep 20s
echo "done!"


