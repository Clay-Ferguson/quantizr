#!/bin/bash
###############################################################################
# This script can serve as an example of how to STOP the server.
#
# (see file `build--localhost-test.sh`)
###############################################################################

source ./define-functions.sh
source ./setenv--localhost-test.sh

docker-compose -f ${docker_compose_yaml} down --remove-orphans
verifySuccess "Docker Compose: down"

sleep 3


