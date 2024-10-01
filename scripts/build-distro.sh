#!/bin/bash -i
#
# Tip: You may want to update QUANTA_VER in setenv-version.sh before running this script.
#
# (NOTE: -i arg makes .bashrc get sourced and without this yarn commands won't be found)

# To just build a folder to deploy from (which can be used to run remote docker IMAGES from) set this
# compile variable to "no", and be sure DEPLOY_TARGET (set in setenv-*.sh) is set to the folder you want to build 
COMPILE=yes

# --------------------------------------------------------------------
# Builds a folder in ${DEPLOY_TARGET}, (which is normally just the ./distro folder in the project)
# that can be used to run the app.
# --------------------------------------------------------------------

clear
# show commands as they are run.
# set -x

# Set all environment variables
source ./setenv-build-distro.sh
checkFunctions

echo "Preparing DEPLOY_TARGET: ${DEPLOY_TARGET}"
sudo rm -r ${DEPLOY_TARGET}
mkdir -p ${DEPLOY_TARGET}
verifySuccess "Cleaned deploy target"

mkdir -p ${DEPLOY_TARGET}/log
mkdir -p ${DEPLOY_TARGET}/QuantaAI
mkdir -p ${DEPLOY_TARGET}/common
mkdir -p ${DEPLOY_TARGET}/QuantaAgent

# Copy our primary logger file out to the live-loadable configured location
# (note: without the 'logging.config' being set in the docker yaml this file would
# load from /src/main/resouces which is the spring default location.)
cp ${PRJROOT}/src/main/resources/logback-spring.xml ${DEPLOY_TARGET}/log/logback.xml

# copy some configs and scripts to deploy target
cd ${PRJROOT}
cp ${PRJROOT}/dc-distro.yaml                    ${DEPLOY_TARGET}
cp ${PRJROOT}/dockerfile-distro                 ${DEPLOY_TARGET}
cp ${PRJROOT}/dockerfile-qai                    ${DEPLOY_TARGET}
cp ${PRJROOT}/entrypoint-distro.sh              ${DEPLOY_TARGET}

rsync -av --exclude='__pycache__' ${PRJROOT}/QuantaAI/      ${DEPLOY_TARGET}/QuantaAI/
rsync -av --exclude='__pycache__' ${PRJROOT}/common/        ${DEPLOY_TARGET}/common/
rsync -av --exclude='__pycache__' ${PRJROOT}/QuantaAgent/   ${DEPLOY_TARGET}/QuantaAgent/

# copy scripts needed to start/stop to deploy target
cp ${SCRIPTS}/run-distro.sh                 ${DEPLOY_TARGET}
cp ${SCRIPTS}/mongo-backup.sh               ${DEPLOY_TARGET}
cp ${SCRIPTS}/postgres-backup.sh            ${DEPLOY_TARGET}
cp ${SCRIPTS}/stop-distro.sh                ${DEPLOY_TARGET}
cp ${SCRIPTS}/define-functions.sh           ${DEPLOY_TARGET}
cp ${SCRIPTS}/setenv-run-distro.sh          ${DEPLOY_TARGET}
cp ${SCRIPTS}/set-version.sh                ${DEPLOY_TARGET}

mkdir -p ${DEPLOY_TARGET}/backup
mkdir -p ${DEPLOY_TARGET}/tmp
mkdir -p ${DEPLOY_TARGET}/log
mkdir -p ${DEPLOY_TARGET}/config
mkdir -p ${MONGO_DATA}
mkdir -p ${POSTGRES_DATA}

# Default app configs
# We only need this if overriding/extending the default properties
# cp ${PRJROOT}/src/main/resources/config-text-distro.yaml    ${DEPLOY_TARGET}/config

# copy our banding folder to deploy target
rsync -aAX --delete --force --progress --stats "${PRJROOT}/branding/" "${DEPLOY_TARGET}/branding/"

genInitReplica
makeMongoKeyFile
genMongoConfig

if [ "${COMPILE}" == "yes" ]; then
# build the project (compile all source)
cd ${PRJROOT}
. ${SCRIPTS}/build.sh

# This builds the images locally, and saves them into local docker repository, so that 'docker-compose up',
# is all that's required.
cd ${DEPLOY_TARGET}
dockerBuild
echo "Docker build complete..."
fi

imageCheck ${DOCKER_IMAGE}
imageCheck ${QAI_IMAGE}

echo
echo "==================== NOTE ======================================="
echo "Run docker-publish-distro.sh to publish the distro to docker repo"
echo "You can test locally (before publishing) by running:"
echo "${DEPLOY_TARGET}/run-distro.sh"
echo "================================================================="
echo 
echo "************ Build Complete in ${DEPLOY_TARGET}"

read -p "Press a Key"
