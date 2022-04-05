#!/bin/bash
# set -x

# change to folder this script file is in
cd $(dirname $(realpath $0))
source ./setenv-dev.sh

cd ${PRJROOT}
dockerDown ${dc_app_yaml} quanta-dev
dockerDown ${dc_mongo_yaml} mongo-dev
dockerDown ${dc_ipfs_yaml} ipfs-dev

# docker ps
sleep 3
