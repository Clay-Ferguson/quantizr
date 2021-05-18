#!/bin/bash

# The production builder for generating deployment files to put on https://quanta.wiki

###############################################################################
# This script builds a deployable quanta-prod.tar, which is able to be 
# deployed stand-alone at https://quanta.wiki. This is the production builder
# for Quanta.wiki
###############################################################################

if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

clear
# show commands as they are run.
set -x

source ./setenv--quanta.wiki.sh

# Wipe some existing stuff to ensure with certainty it gets rebuilt
rm -rf ${PROD_DEPLOYER_BASE}/${quanta_domain}/quanta-prod.tar

cd ${PRJROOT}
cp ${docker_compose_yaml} ${PROD_DEPLOYER_BASE}/${quanta_domain}

cd ${PRJROOT}
. ${SCRIPTS}/_build.sh

# IMPORTANT: Use this to troubeshoot the variable substitutions in the yaml file
# docker-compose -f ${docker_compose_yaml} config 
# read -p "Config look ok?"
# I was seeing docker fail to deploy new code EVEN after I'm sure i built new code, and ended up finding
# this stackoverflow saying how to work around this (i.e. first 'build' then 'up') 
# https://stackoverflow.com/questions/35231362/dockerfile-and-docker-compose-not-updating-with-new-instructions
docker-compose -f ${docker_compose_yaml} build --no-cache
verifySuccess "Docker Compose: build"

# save the docker image into a TAR file so that we can send it up to the remote Linode server
# which can then on the remote server be loaded into registry for user on that host using the following command:
#     docker load -i <path to image tar file>
#
docker save -o ${PROD_DEPLOYER_BASE}/${quanta_domain}/quanta-prod.tar quanta-prod
verifySuccess "Docker Save"
read -p "Build Successful. press a key"

cd ${PROD_DEPLOYER_BASE}/management/${quanta_domain}
./deploy.sh

cd ${PROD_DEPLOYER_BASE}/management/${quanta_domain}
./ssh-remote-run.sh

read -p "All done. press a key"
