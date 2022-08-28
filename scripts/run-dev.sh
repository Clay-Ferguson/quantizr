#!/bin/bash

# Starts the app without doing any build. Just uses current image and YAML settings.

clear
# show commands as they are run.
# set -x

# Make the folder holding this script become the current working directory
SCRIPT=$(readlink -f "$0")
SCRIPTPATH=$(dirname "$SCRIPT")
echo "cd $SCRIPTPATH"
cd "$SCRIPTPATH"

source ./setenv-dev.sh

makeDirs
rm -rf ${QUANTA_BASE}/log/*
mkdir -p ${QUANTA_BASE}/log
cp ${PRJROOT}/src/main/resources/logback-spring.xml ${QUANTA_BASE}/log/logback.xml

cd ${PRJROOT}
dockerDown
dockerUp

printUrlsMessage

