#!/bin/bash
# set -x

source ./setenv--localhost-dev.sh

 cd ${DEPLOY_TARGET}
dockerDown quanta-dev
dockerDown mongo-dev

# docker ps
sleep 3
