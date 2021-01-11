#!/bin/bash
###############################################################################
# This script builds a deployable subnode-prod.tar, which is able to be 
# deployed stand-alone at https://quanta.wiki. This is the production builder
# for Quanta.wiki
###############################################################################

if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

clear
# show commands as they are run.
# set -x

source ./define-functions.sh
source ./setenv-common.sh
source ./setenv--quanta.wiki.sh

# Wipe some existing stuff to ensure with certainty it gets rebuilt
rm -rf ${PROD_DEPLOYER_BASE}/${quanta_domain}/subnode-prod.tar

cd ${PRJROOT}
cp ${docker_compose_yaml} ${PROD_DEPLOYER_BASE}/${quanta_domain}/${docker_compose_yaml}

cd ${PRJROOT}
. ${SCRIPTS}/_build.sh

# save the docker image into a TAR file so that we can send it up to the remote Linode server
# which can then on the remote server be loaded into registry for user on that host using the following command:
#     docker load -i <path to image tar file>
#
docker save -o ${PROD_DEPLOYER_BASE}/${quanta_domain}/subnode-prod.tar subnode-prod
verifySuccess "Docker Save"
read -p "Build Successful. press a key"

cd ${PROD_DEPLOYER_BASE}/management/${quanta_domain}
./deploy.sh

cd ${PROD_DEPLOYER_BASE}/management/${quanta_domain}
./ssh-remote-run.sh

read -p "All done. press a key"
