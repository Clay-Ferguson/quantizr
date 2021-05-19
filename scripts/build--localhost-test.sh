#!/bin/bash

# NOTE: If you don't know why this file is here then you can ignore it. This script being run here
# only contains a command to change to the [project]/scripts/ direcory when it's run from inside VSCode
# so if you are running this builder outside of VSCode terminal you can ignoure this 'vscode-cwd.sh' stuff 
if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

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
cp ${SECRETS}/secrets.sh    ${DEPLOY_TARGET}/dumps

# copy the database backup scripts to deploy location
cp ${SCRIPTS}/backup--localhost-test.sh   ${DEPLOY_TARGET}
cp ${SCRIPTS}/_backup--localhost-test.sh  ${DEPLOY_TARGET}/dumps

# copy the database restore scripts to deploy target
cp ${SCRIPTS}/restore--localhost-test.sh  ${DEPLOY_TARGET}
cp ${SCRIPTS}/_restore--localhost-test.sh ${DEPLOY_TARGET}/dumps

# copy our banding folder to deploy target
rsync -aAX --delete --force --progress --stats "${PRJROOT}/branding/" "${DEPLOY_TARGET}/branding/"

# ensure the IPFS folders exist
mkdir -p ${ipfs_data}
mkdir -p ${ipfs_staging}

# Wipe previous deployment jars to ensure it can't be used again.
rm -f  ${DEPLOY_TARGET}/org.subnode-0.0.1-SNAPSHOT.jar
rm -f ${PRJROOT}/target/org.subnode-0.0.1-SNAPSHOT.jar

# build the project (comile source)
cd ${PRJROOT}
. ${SCRIPTS}/_build.sh

cp ${PRJROOT}/target/org.subnode-0.0.1-SNAPSHOT.jar ${DEPLOY_TARGET}

read -p "Build Complete. press a key"

