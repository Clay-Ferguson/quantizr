#!/bin/bash

# The production builder for generating deployment files to put on https://quanta.wiki

###############################################################################
# This script builds a deployable quanta-prod.tar, which is able to be 
# deployed stand-alone at https://quanta.wiki. This is the production builder
# for Quanta.wiki
###############################################################################

clear
# show commands as they are run.
set -x

source ./setenv--quanta.wiki.sh

cd ${PRJROOT}
cp ${docker_compose_yaml}       ${PROD_DEPLOYER_BASE}/${quanta_domain}
cp ${PRJROOT}/dockerfile-prod   ${PROD_DEPLOYER_BASE}/${quanta_domain}
cp ${PRJROOT}/entrypoint.sh     ${PROD_DEPLOYER_BASE}/${quanta_domain}

# Wipe previous jars to ensure it can't be used again.
rm -f ${PROD_DEPLOYER_BASE}/${quanta_domain}/org.subnode-0.0.1-SNAPSHOT.jar
rm -f ${PRJROOT}/target/org.subnode-0.0.1-SNAPSHOT.jar

cd ${PRJROOT}
. ${SCRIPTS}/_build.sh

cp ${PRJROOT}/target/org.subnode-0.0.1-SNAPSHOT.jar ${PROD_DEPLOYER_BASE}/${quanta_domain}
verifySuccess "Copied jar"

# IMPORTANT: Use this to troubeshoot the variable substitutions in the yaml file
# docker-compose -f ${docker_compose_yaml} config 
# read -p "Config look ok?"
# I was seeing docker fail to deploy new code EVEN after I'm sure i built new code, and ended up finding
# this stackoverflow saying how to work around this (i.e. first 'build' then 'up') 
# https://stackoverflow.com/questions/35231362/dockerfile-and-docker-compose-not-updating-with-new-instructions

cd ${PROD_DEPLOYER_BASE}/management/${quanta_domain}
./deploy.sh

cd ${PROD_DEPLOYER_BASE}/management/${quanta_domain}
./ssh-remote-run.sh

read -p "All done. press a key"
