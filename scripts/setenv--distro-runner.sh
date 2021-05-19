#!/bin/bash

# todo-0: For the "real" downloadable file for users, we need a version of this script that
# doesn't contain the vars only needed for building it.

source ./define-functions.sh
source ./secrets.sh

export DEPLOY_TARGET=$PWD
export quanta_domain=localhost
export docker_compose_yaml=docker-compose-distro.yaml
export ipfs_data=${DEPLOY_TARGET}/ipfs
export ipfs_staging=${DEPLOY_TARGET}/ipfs/staging
export QUANTA_VER=1.0.1