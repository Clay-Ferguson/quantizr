#!/bin/bash

# force current dir to be this script
script_file=$(realpath $0)
script_folder="$(dirname "${script_file}")"
cd ${script_folder}

# show commands as they are run.
# set -x
source ./setenv-dev.sh

# First substitute variables into the yaml and write it to the '*--k8.yaml' file
cd ${PRJROOT}
# docker-compose -f docker-compose-dev-app.yaml config > docker-compose-dev-app--k8.yaml
# docker-compose -f docker-compose-dev-mongo.yaml config > docker-compose-dev-mongo--k8.yaml

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
kompose convert -f docker-compose-dev-app--k8.yaml -o k8-dev-app.yaml
kompose convert -f docker-compose-dev-mongo--k8.yaml -o k8-dev-mongo.yaml

read -p "kompose done. press a key"
