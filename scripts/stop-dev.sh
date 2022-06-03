#!/bin/bash
# set -x

# Make the folder holding this script become the current working directory
SCRIPT=$(readlink -f "$0")
SCRIPTPATH=$(dirname "$SCRIPT")
echo "cd $SCRIPTPATH"
cd "$SCRIPTPATH"

source ./setenv-dev.sh

cd ${PRJROOT}
dockerDown ${dc_app_yaml} quanta-dev
dockerDown ${dc_mongo_yaml} mongo-dev
dockerDown ${dc_ipfs_yaml} ipfs-dev

# docker ps
sleep 3
