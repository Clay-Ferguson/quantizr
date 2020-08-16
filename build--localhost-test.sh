#!/bin/bash

###############################################################################
# This script builds a deployable subnode-test.tar, which is able to be 
# deployed stand-alone somewhere at localhost, normally for testing, or just
# for using Quanta as a personal/local productivity tool. It's configured
# to run at http://locahost:8181
###############################################################################

clear
# show commands as they are run.
# set -x
source ./define-functions.sh
source ./setenv--localhost-test.sh

cd ${DEPLOY_TARGET}
sudo ./stop.sh

sudo rm -f ${DEPLOY_TARGET}/log/*
mkdir -p ${ipfs_staging}

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
sudo cp ${PRJROOT}/setenv-common.sh ${DEPLOY_TARGET}/setenv-common.sh
sudo cp ${PRJROOT}/run.sh ${DEPLOY_TARGET}/run.sh
sudo cp ${PRJROOT}/stop.sh ${DEPLOY_TARGET}/stop.sh
sudo cp ${PRJROOT}/mongodb-backup.sh ${DEPLOY_TARGET}/mongodb-backup.sh

# Note: this 'dumps' folder is mapped onto a volume in 'docker-compose-test.yaml' and the 'backup-local.sh'
#       script should only be run from 'inside' the docker container, which is what 'mongodb-backup.sh' actually does.
sudo cp ${PRJROOT}/backup-local.sh ${DEPLOY_TARGET}/dumps/backup-local.sh

read -p "Build Complete. press a key"

