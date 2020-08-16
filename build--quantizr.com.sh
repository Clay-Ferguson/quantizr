#!/bin/bash
###############################################################################
# This script builds a deployable subnode-test.tar, which is able to be 
# deployed stand-alone at https://quantizr.com. This is the production builder
# for Quantizr.com, which is a domain used only for testing and development
# of certain specific features like ActivityPub (Mastodon connectivity, etc.)
# that require a domain name on the public internet with HTTPS enabled.
###############################################################################

clear
# show commands as they are run.
# set -x
source ./define-functions.sh
source ./setenv--quantizr.com.sh

# Wipe some existing stuff to ensure with certainty it gets rebuilt
rm -rf ${PROD_DEPLOYER_BASE}/${quanta_domain}/subnode-prod.tar

cd ${PRJROOT}
. ./_build.sh

# save the docker image into a TAR file so that we can send it up to the remote Linode server
# which can then on the remote server be loaded into registry for user on that host using the following command:
#     docker load -i <path to image tar file>
#
docker save -o ${PROD_DEPLOYER_BASE}/${quanta_domain}/subnode-prod.tar subnode-prod
verifySuccess "Docker Save"

read -p "Build Complete. press a key"
