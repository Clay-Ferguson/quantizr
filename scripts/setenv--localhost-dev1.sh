#!/bin/bash
# see: https://quanta.wiki/n/localhost-fediverse-testing

# Configures build variables for first instance in
# a federated development enviroment.

source ./define-functions.sh

export PRJROOT=/home/clay/ferguson/Quantizr
export SCRIPTS=${PRJROOT}/scripts

export SECRETS=/home/clay/ferguson/secrets
source ${SECRETS}/secrets.sh

export ipfs_data=/home/clay/.ipfs1
export ipfs_staging=/home/clay/.ipfs1/staging

export quanta_domain=localhost

# Docker files are relative to project root
export docker_compose_yaml=docker-compose-dev1.yaml

export mvn_profile=dev

export MONGO_BASE=/home/clay/mongo1
export QUANTA_BASE=/home/clay/quanta-localhost-dev1
