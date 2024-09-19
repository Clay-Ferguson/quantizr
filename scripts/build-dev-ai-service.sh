#!/bin/bash

# During development, when the app is already running, and we know only Python files have changed
# (meaning our ai microservice) we can use this script to rebuild the app and update the running container.

clear
# show commands as they are run.
# set -x

# Set all environment variables
source ./setenv-dev.sh
checkFunctions

# Rebuild the AI service container
cd ${PRJROOT}
dockerBuildService qai-dev

# get rid of AI log file
rm ${QUANTA_BASE}/log/quanta_ai.log

cd ${PRJROOT}
QAI_SERVICE_ID=$(docker service ls --filter name=quanta-stack-dev_qai-dev --quiet)

# If server is apparently not running show error and exit
if [[ -z ${QAI_SERVICE_ID} ]]; then  
    echo "FAILED: Is the server running? Container quanta-stack-dev_qai-dev not found."
    read -p "Press any key to exit..." -n1 -s
    exit
fi

# Force service to restart
docker service update --force ${QAI_SERVICE_ID}

echo "Waiting for server to start..."
sleep 3
echo "done!"


