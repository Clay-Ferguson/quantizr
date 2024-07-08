#!/bin/bash

# Starts the app without doing any build. Just uses current image and YAML settings.

clear
# show commands as they are run.
# set -x

source ./setenv-dev.sh

makeDirs
rm -rf ${QUANTA_BASE}/log/*
mkdir -p ${QUANTA_BASE}/log
cp ${PRJROOT}/src/main/resources/logback-spring.xml ${QUANTA_BASE}/log/logback.xml

# To see all the substitution variables in the file.
# docker-compose -f ${dc_yaml} config > final-${dc_yaml}

cd ${PRJROOT}
dockerDown
dockerUp

# only required to run once to initialize the replica set
# runInitReplica

# commenting this out, and doing it in compose file instead.
# echo "Scaling Replicas"
# docker service scale quanta-stack-dev_quanta-dev=2

printUrlsMessage

