#!/bin/bash

###############################################################################
# 
# This script builds a deployable subnode-test.tar, which is able to be 
# deployed stand-alone somewhere at localhost, normally for testing, or just
# for using Quanta as a personal/local productivity tool. It's configured
# to run at http://locahost:8181
#
# WARNING: This overwrites any of it's own files in ${PRJROOT}, as you can see
# in all the copy commands below. After you run this script you should be able
# to go run ${PRJROOT}/run-test.sh and bring up the app.
#
###############################################################################

clear
# show commands as they are run.
# set -x
source ./define-functions.sh
source ./setenv--localhost-test.sh

mkdir -p ${DEPLOY_TARGET}

cp ${PRJROOT}/docker-compose-test.yaml ${DEPLOY_TARGET}/docker-compose-test.yaml
cp ${PRJROOT}/dockerfile-test ${DEPLOY_TARGET}/dockerfile-test
cp ${PRJROOT}/define-functions.sh ${DEPLOY_TARGET}/define-functions.sh

cd ${DEPLOY_TARGET}
. ./stop-test.sh

sudo rm -f ${DEPLOY_TARGET}/log/*
mkdir -p ${ipfs_staging}

# Wipe some existing stuff to ensure with certainty it gets rebuilt
rm -rf ${DEPLOY_TARGET}/subnode-test.tar

cd ${PRJROOT}
. ./_build.sh

docker save -o ${DEPLOY_TARGET}/subnode-test.tar subnode-test
verifySuccess "Docker Save"

cd ${PRJROOT}

# this is a special file we alter the owner of in the run script.
sudo cp ${PRJROOT}/mongod--localhost-test.conf ${DEPLOY_TARGET}/mongod.conf

cp ${PRJROOT}/setenv--localhost-test.sh ${DEPLOY_TARGET}/setenv--localhost-test.sh
cp ${PRJROOT}/setenv-common.sh ${DEPLOY_TARGET}/setenv-common.sh
cp ${PRJROOT}/run-test.sh ${DEPLOY_TARGET}/run-test.sh
cp ${PRJROOT}/stop-test.sh ${DEPLOY_TARGET}/stop-test.sh

# Note: this 'dumps' folder is mapped onto a volume in 'docker-compose-test.yaml' and the 'backup-local.sh'
#       script should only be run from 'inside' the docker container, which is what 'mongodb-backup.sh' actually does.
mkdir -p ${DEPLOY_TARGET}/dumps

cp ../secrets/secrets.sh ${DEPLOY_TARGET}/dumps/secrets.sh

cp ${PRJROOT}/backup--localhost-test.sh ${DEPLOY_TARGET}/backup--localhost-test.sh
cp ${PRJROOT}/_backup--localhost-test.sh ${DEPLOY_TARGET}/dumps/_backup--localhost-test.sh

cp ${PRJROOT}/restore--localhost-test.sh ${DEPLOY_TARGET}/restore--localhost-test.sh
cp ${PRJROOT}/_restore--localhost-test.sh ${DEPLOY_TARGET}/dumps/_restore--localhost-test.sh

read -p "Build Complete. press a key"

