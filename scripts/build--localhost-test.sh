#!/bin/bash

# NOTE: If you don't know why this file is here then you can ignore it. This script being run here
# only contains a command to change to the [project]/scripts/ direcory when it's run from inside VSCode
# so if you are running this builder outside of VSCode terminal you can ignoure this 'vscode-cwd.sh' stuff 
if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

###############################################################################
# 
# This script builds a deployable quanta-test.tar, which is able to be 
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
cp ${SCRIPTS}/define-functions.sh ${DEPLOY_TARGET}/define-functions.sh

cd ${DEPLOY_TARGET}
. ${SCRIPTS}/stop-test.sh

sudo rm -f ${DEPLOY_TARGET}/log/*
mkdir -p ${ipfs_data}
mkdir -p ${ipfs_staging}

# Wipe some existing stuff to ensure with certainty it gets rebuilt
rm -rf ${DEPLOY_TARGET}/quanta-test.tar

cd ${PRJROOT}
. ${SCRIPTS}/_build.sh

docker save -o ${DEPLOY_TARGET}/quanta-test.tar quanta-test
verifySuccess "Docker Save"

cd ${PRJROOT}

# this is a special file we alter the owner of in the run script.
sudo cp ${SCRIPTS}/mongod--localhost-test.conf ${DEPLOY_TARGET}/mongod.conf

cp ${SCRIPTS}/setenv--localhost-test.sh ${DEPLOY_TARGET}/setenv--localhost-test.sh
cp ${SCRIPTS}/run-test.sh ${DEPLOY_TARGET}/run-test.sh
cp ${SCRIPTS}/stop-test.sh ${DEPLOY_TARGET}/stop-test.sh

# Note: this 'dumps' folder is mapped onto a volume in 'docker-compose-test.yaml' and the 'backup-local.sh'
#       script should only be run from 'inside' the docker container, which is what 'mongodb-backup.sh' actually does.
mkdir -p ${DEPLOY_TARGET}/dumps

cp ${SECRETS}/secrets.sh ${DEPLOY_TARGET}/dumps/secrets.sh

cp ${SCRIPTS}/backup--localhost-test.sh ${DEPLOY_TARGET}/backup--localhost-test.sh
cp ${SCRIPTS}/_backup--localhost-test.sh ${DEPLOY_TARGET}/dumps/_backup--localhost-test.sh

cp ${SCRIPTS}/restore--localhost-test.sh ${DEPLOY_TARGET}/restore--localhost-test.sh
cp ${SCRIPTS}/_restore--localhost-test.sh ${DEPLOY_TARGET}/dumps/_restore--localhost-test.sh

rsync -aAX --delete --force --progress --stats "./branding/" "${DEPLOY_TARGET}/branding/"

read -p "Build Complete. press a key"

