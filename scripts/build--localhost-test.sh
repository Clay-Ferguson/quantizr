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

source ./setenv--localhost-test.sh

mkdir -p ${DEPLOY_TARGET}

# copy docker files to deploy target
cp ${PRJROOT}/docker-compose-test.yaml    ${DEPLOY_TARGET}
cp ${PRJROOT}/dockerfile-test             ${DEPLOY_TARGET}

# copy scripts needed to start/stop to deploy target
cp ${SCRIPTS}/run-test.sh                 ${DEPLOY_TARGET}
cp ${SCRIPTS}/stop-test.sh                ${DEPLOY_TARGET}
cp ${SCRIPTS}/define-functions.sh         ${DEPLOY_TARGET}
cp ${SCRIPTS}/setenv--localhost-test.sh   ${DEPLOY_TARGET}

# this is a special file we alter the owner of in the run script.
cp ${SCRIPTS}/mongod--localhost-test.conf ${DEPLOY_TARGET}/mongod.conf

# Note: this 'dumps' folder is mapped onto a volume in 'docker-compose-test.yaml' and the 'backup-local.sh'
#       script should only be run from 'inside' the docker container, which is what 'mongodb-backup.sh' actually does.
mkdir -p ${DEPLOY_TARGET}/dumps

mkdir -p ${DEPLOY_TARGET}/config

# copy our secrets (passwords, etc) to deploy location
cp ${SECRETS}/secrets.sh                  ${DEPLOY_TARGET}/dumps

# copy the database backup scripts to deploy location
cp ${SCRIPTS}/backup--localhost-test.sh   ${DEPLOY_TARGET}
cp ${SCRIPTS}/_backup--localhost-test.sh  ${DEPLOY_TARGET}/dumps

# copy the database restore scripts to deploy target
cp ${SCRIPTS}/restore--localhost-test.sh  ${DEPLOY_TARGET}
cp ${SCRIPTS}/_restore--localhost-test.sh ${DEPLOY_TARGET}/dumps

# copy our banding folder to deploy target
rsync -aAX --delete --force --progress --stats "${PRJROOT}/branding/" "${DEPLOY_TARGET}/branding/"

# stop the server if running
cd ${DEPLOY_TARGET}
. ${SCRIPTS}/stop-test.sh

# ensure logs is cleaned up
sudo rm -rf ${DEPLOY_TARGET}/log/*

# ensure the IPFS folders exist
mkdir -p ${ipfs_data}
mkdir -p ${ipfs_staging}

# Wipe previous deployment to ensure it can't be used again.
rm -rf ${DEPLOY_TARGET}/quanta-test.tar

# build the project (comile source)
cd ${PRJROOT}
. ${SCRIPTS}/_build.sh

# move deployment binary into target location
docker save -o ${DEPLOY_TARGET}/quanta-test.tar quanta-test
verifySuccess "Docker Save"

read -p "Build Complete. press a key"

