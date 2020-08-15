#!/bin/bash
clear
# show commands as they are run.
# set -x
source ./define-functions.sh

export ipfs_data=/home/clay/.ipfs
export ipfs_staging=/home/clay/.ipfs/staging

source /home/clay/ferguson/secrets/secrets.sh

# Directory that contains the SubNode project (pom.xml is here, for example). This is the only
# hard-coded path, in the bash scripts
export PRJROOT=/home/clay/ferguson/Quantizr

export quanta_domain=quantizr.com

# INSTANCE_FOLDER tells docker yaml volume where to find mongo-scripts folder and mongod.conf file.
export INSTANCE_FOLDER=/home/clay/quanta

# DATA_FOLDER tells docker yaml volume where to find mongo-dumps folder
export DATA_FOLDER=/home/clay/quanta-data

# IMPORTANT: ***** You must set this to 'true' to regenerate the Java->TypeScript interfaces.
export CLEAN=true

export docker_compose_yaml=docker-compose-prod.yaml

export mvn_profile=prod

# Wipe some existing stuff to ensure with certainty it gets rebuilt
rm -rf ~/ferguson/scripts/linode/${quanta_domain}/subnode-prod.tar

cd ${PRJROOT}
. ./_build.sh

# save the docker image into a TAR file so that we can send it up to the remote Linode server
# which can then on the remote server be loaded into registry for user on that host using the following command:
#     docker load -i <path to image tar file>
#
docker save -o ~/ferguson/scripts/linode/${quanta_domain}/subnode-prod.tar subnode-prod
verifySuccess "Docker Save"

read -p "Build Complete. press a key"
