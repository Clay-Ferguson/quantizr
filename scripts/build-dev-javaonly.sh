#!/bin/bash

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

# to get all services: `docker service ls``
cd ${PRJROOT}
QUANTA_SERVICE_ID=$(docker service ls --filter name=quanta-stack-dev_quanta-dev --quiet)
docker service update --force ${QUANTA_SERVICE_ID}

echo "Waiting 15s for Server startup" 
sleep 15s
echo "done!"


