#!/bin/bash

# =================================================================================================
# Builds a production distro zip file, which should be able to be unzipped and run on any
# linux box to run an instance of the app, with all default settings. Startup scripts in this zip file should
# be able to be run by non-developers and is stand-alone, with minimal setup required
# to get an instance of Quanta up and running
# =================================================================================================

# NOTE: If you don't know why this vscode-cwd.sh is here then you can ignore it. This script being run here
# only contains a command to change to the [project]/scripts/ direcory when it's run from inside VSCode
# so if you are running this builder outside of VSCode terminal you can ignoure this 'vscode-cwd.sh' stuff 
if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

clear
# show commands as they are run.
# set -x

source ./setenv--distro.sh

# sanity check since we do "rm -rf" in here
if [ -z "$DEPLOY_TARGET" ]; then exit; fi
rm -rf ${DEPLOY_TARGET}/*
verifySuccess "Cleaned deploy target"
mkdir -p ${DEPLOY_TARGET}

# copy docker files to deploy target
cp ${PRJROOT}/docker-compose-distro.yaml    ${DEPLOY_TARGET}

# copy scripts needed to start/stop to deploy target
cp ${SCRIPTS}/run-distro.sh                 ${DEPLOY_TARGET}
cp ${SCRIPTS}/stop-distro.sh                ${DEPLOY_TARGET}
cp ${SCRIPTS}/define-functions.sh           ${DEPLOY_TARGET}
cp ${SCRIPTS}/setenv--distro-runner.sh      ${DEPLOY_TARGET}

# this is a special file we alter the owner of in the run script.
cp ${SCRIPTS}/mongod--distro.conf           ${DEPLOY_TARGET}/mongod.conf

# Note: this 'dumps' folder is mapped onto a volume in 'docker-compose-distro.yaml' and the 'backup-local.sh'
#       script should only be run from 'inside' the docker container, which is what 'mongodb-backup.sh' actually does.
mkdir -p ${DEPLOY_TARGET}/dumps
mkdir -p ${DEPLOY_TARGET}/config

# copy our secrets (passwords, etc) to deploy location
# cp ${PRJROOT}/secrets/secrets.sh                  ${DEPLOY_TARGET}/dumps/secrets.sh
cp ${PRJROOT}/secrets/secrets.sh    ${DEPLOY_TARGET}
cp ${PRJROOT}/secrets/mongo.env     ${DEPLOY_TARGET}

# Default app configs
cp ${PRJROOT}/src/main/resources/config-text-distro.yaml    ${DEPLOY_TARGET}/config

# copy the database backup scripts to deploy location
# cp ${SCRIPTS}/backup--localhost-test.sh   ${DEPLOY_TARGET}/backup--localhost-test.sh
# cp ${SCRIPTS}/_backup--localhost-test.sh  ${DEPLOY_TARGET}/dumps/_backup--localhost-test.sh

# # copy the database restore scripts to deploy target
# cp ${SCRIPTS}/restore--localhost-test.sh  ${DEPLOY_TARGET}/restore--localhost-test.sh
# cp ${SCRIPTS}/_restore--localhost-test.sh ${DEPLOY_TARGET}/dumps/_restore--localhost-test.sh

# copy our banding folder to deploy target
rsync -aAX --delete --force --progress --stats "${PRJROOT}/branding/" "${DEPLOY_TARGET}/branding/"

# ensure the IPFS folders exist
mkdir -p ${ipfs_data}
mkdir -p ${ipfs_staging}

# Wipe previous springboot fat jar to ensure it can't be used again.
rm -f ${PRJROOT}/target/org.subnode-0.0.1-SNAPSHOT.jar

# build the project (comile source)
cd ${PRJROOT}
. ${SCRIPTS}/_build.sh

TARGET_PARENT="$(dirname "${DEPLOY_TARGET}")"
cd ${TARGET_PARENT}
tar cvzf ${PRJROOT}/distro/quanta${QUANTA_VER}.tar.gz quanta-distro

echo
echo "==================== IMPORTANT ======================================="
echo "Run docker-publish-distro.sh to actually publish the distro."
echo "You can test locally (before publishing) by running:"
echo "${DEPLOY_TARGET}/run-distro.sh"
echo "======================================================================"
echo 
echo "Build Complete: ${PRJROOT}/distro/quanta${QUANTA_VER}.tar.gz"
