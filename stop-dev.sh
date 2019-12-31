#!/bin/bash
clear
source ./setenv.sh
source ./define-functions.sh
source ${SECRET_SCRIPT}

cd $PRJROOT
# Warning: removing orphans will kill ALL docker instances running on the host basically.
docker-compose -f docker-compose-dev.yaml down --remove-orphans
verifySuccess "Docker Compose: down"

echo "stop.sh done."
sleep 3
