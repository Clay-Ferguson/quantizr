#!/bin/bash
clear
# show commands as they are run.
# set -x
source ./define-functions.sh
source ./setenv--localhost-test.sh

cd /home/clay/ferguson/subnode-run
sudo ./stop.sh

sudo rm -f /home/clay/ferguson/subnode-run/log/*
mkdir -p ${ipfs_staging}

# deploy target folder is where we will be running the app from
DEPLOY_TARGET=~/ferguson/subnode-run

# Wipe some existing stuff to ensure with certainty it gets rebuilt
rm -rf ${DEPLOY_TARGET}/subnode-test.tar

cd ${PRJROOT}
. ./_build.sh

sudo docker save -o ${DEPLOY_TARGET}/subnode-test.tar subnode-test
verifySuccess "Docker Save"

sudo cp ${PRJROOT}/docker-compose-test.yaml ${DEPLOY_TARGET}/docker-compose-test.yaml
sudo cp ${PRJROOT}/dockerfile-test ${DEPLOY_TARGET}/dockerfile-test
sudo cp ${PRJROOT}/define-functions.sh ${DEPLOY_TARGET}/define-functions.sh
sudo cp ${PRJROOT}/mongod.conf ${DEPLOY_TARGET}/mongod.conf
sudo cp ${PRJROOT}/setenv--localhost-test.sh ${DEPLOY_TARGET}/setenv--localhost-test.sh

read -p "Build Complete. press a key"

