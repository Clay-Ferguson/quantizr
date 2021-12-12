#!/bin/bash

# =================================================================================================
# Builds a production distro zip file, which should be able to be unzipped and run on any
# linux box to run an instance of the app, with all default settings. Startup scripts in this zip file should
# be able to be run by non-developers and is stand-alone, with minimal setup required
# to get an instance of Quanta up and running. It uses docker-compose and will download all binaries
# and all executable code from the Public Docker Repository
# =================================================================================================

clear
# show commands as they are run.
# set -x

# force current dir to be this script
script_file=$(realpath $0)
script_folder="$(dirname "${script_file}")"
cd ${script_folder}

source ./setenv-distro.sh

# sanity check since we do "rm -rf" in here
if [ -z "$DEPLOY_TARGET" ]; then exit; fi
sudo rm -rf ${DEPLOY_TARGET}/*
verifySuccess "Cleaned deploy target"

mkdir -p ${DEPLOY_TARGET}

cd ${PRJROOT}
cp ${PRJROOT}/docker-compose-distro.yaml    ${DEPLOY_TARGET}
cp ${PRJROOT}/dockerfile                    ${DEPLOY_TARGET}
cp ${PRJROOT}/entrypoint.sh                 ${DEPLOY_TARGET}
cp ${PRJROOT}/distro/README.sh              ${DEPLOY_TARGET}

# copy scripts needed to start/stop to deploy target
cp ${SCRIPTS}/gen-mongod-conf-file.sh       ${DEPLOY_TARGET}
cp ${SCRIPTS}/run-distro.sh                 ${DEPLOY_TARGET}
cp ${SCRIPTS}/stop-distro.sh                ${DEPLOY_TARGET}
cp ${SCRIPTS}/define-functions.sh           ${DEPLOY_TARGET}
cp ${SCRIPTS}/setenv-distro-runner.sh       ${DEPLOY_TARGET}

# Note: this 'dumps' folder is mapped onto a volume in 'docker-compose-distro.yaml' and the 'backup-local.sh'
#       script should only be run from 'inside' the docker container, which is what 'mongodb-backup.sh' actually does.
mkdir -p ${DEPLOY_TARGET}/dumps
mkdir -p ${DEPLOY_TARGET}/config

# copy our secrets (passwords, etc) to deploy location
# cp ${PRJROOT}/secrets/secrets.sh                  ${DEPLOY_TARGET}/dumps/secrets.sh
cp ${PRJROOT}/secrets/secrets.sh    ${DEPLOY_TARGET}

# Default app configs
# We only need this if overriding/extending the default properties
# cp ${PRJROOT}/src/main/resources/config-text-distro.yaml    ${DEPLOY_TARGET}/config

# copy our banding folder to deploy target
rsync -aAX --delete --force --progress --stats "${PRJROOT}/branding/" "${DEPLOY_TARGET}/branding/"

# ensure the IPFS folders exist
mkdir -p ${ipfs_data}
mkdir -p ${ipfs_staging}

# Wipe previous springboot fat jar to ensure it can't be used again.
rm -f ${PRJROOT}/target/quanta-0.0.1-SNAPSHOT.jar

# build the project (comile source)
cd ${PRJROOT}
. ${SCRIPTS}/_build.sh

# Create Image
#
# Since we create the image we can also now go run the app directly from ${DEPLOY_TARGET} on this machine 
# if we wanted to and since the image is local it won't be pulling from Public Docker Repo, but as 
# stated in the note below once we do publish to the repo then the TAR file we just created in this script
# will work on all machines anywhere across the web.
cp ${PRJROOT}/target/quanta-0.0.1-SNAPSHOT.jar ${DEPLOY_TARGET}
verifySuccess "JAR copied to build distro"

 ${SCRIPTS}/gen-mongod-conf-file.sh 

# This builds the image locally, and saves it into local docker repository, so that 'docker-compose up',
# is all that's required.
cd ${DEPLOY_TARGET}
dockerBuild

# Now fix up the DEPLOY_TARGET and for end users, and zip it
cp ${PRJROOT}/docker-compose-distro.yaml ${DEPLOY_TARGET}
rm -f ${DEPLOY_TARGET}/quanta-0.0.1-SNAPSHOT.jar

# Copy over the Backup/Restore scripts
cp ${SCRIPTS}/tools/_backup.sh          ${DEPLOY_TARGET}/dumps
cp ${SCRIPTS}/tools/_restore.sh         ${DEPLOY_TARGET}/dumps
cp ${SCRIPTS}/tools/backup.sh           ${DEPLOY_TARGET}
cp ${SCRIPTS}/tools/restore.sh          ${DEPLOY_TARGET}

TARGET_PARENT="$(dirname "${DEPLOY_TARGET}")"
cd ${TARGET_PARENT}

tar -zcvf ${PRJROOT}/distro/quanta${QUANTA_VER}.tar.gz quanta-distro
#NOTE: Extraction command will be: `tar vxf quanta1.0.3.tar.gz`
verifySuccess "TAR created"

echo
echo "==================== IMPORTANT ======================================="
echo "Run docker-publish-distro.sh to actually publish the distro."
echo "You can test locally (before publishing) by running:"
echo "${DEPLOY_TARGET}/run-distro.sh"
echo "======================================================================"
echo 
echo "Build Complete: ${PRJROOT}/distro/quanta${QUANTA_VER}.tar.gz"
