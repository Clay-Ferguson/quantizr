#!/bin/bash

# During development, when the app is already running, and we know only Java files have changed
# we can use this script to rebuild the app and update the running container.

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

# If server is apparently not running show error and exit
if [[ -z ${QUANTA_SERVICE_ID} ]]; then  
    echo "FAILED: Is the server running? Container quanta-stack-dev_quanta-dev not found."
    read -p "Press any key to exit..." -n1 -s
    exit
fi

docker service update --force ${QUANTA_SERVICE_ID}

echo "Waiting for server to start..."
sleep 10
echo "done!"


