#!/bin/bash

# change to folder this script file is in
cd $(dirname $(realpath $0))
# show commands as they are run.
# set -x
source ./setenv-dev.sh

# First substitute variables into the yaml and write it to the '*--k8.yaml' file
cd ${PRJROOT}
docker-compose -f dc-dev-app.yaml config > dc-dev-app--k8.yaml
# docker-compose -f dc-dev-mongo.yaml config > dc-dev-mongo--k8.yaml

# =======================================================================================================
# WARNING: The depends_on sections need to be formatted like this:
# 
#    depends_on:
#            - ipfs-dev
#
# because if there's a condition part of the depends_on put in by the 'config' converter that will choke
# kompose. It's a known bug: (https://github.com/kubernetes/kompose/issues/1371)
#
# =====================================================================================================

# Now we can translate the converted output file to k8 format
# (NOTE: kompose is an inexact thing, and only gives us an imperfect head start on creating the real file)
# kompose convert -f dc-dev-app--k8.yaml -o k8-dev-app.yaml
# kompose convert -f dc-dev-mongo--k8.yaml -o k8-dev-mongo.yaml

read -p "kompose done. press a key"
