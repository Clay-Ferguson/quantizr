#!/bin/bash

export ipfs_data=/home/clay/.ipfs
export ipfs_staging=/home/clay/.ipfs/staging

source ./setenv-common.sh

export quanta_domain=localhost

# IMPORTANT: ***** You must set this to 'true' to regenerate the Java->TypeScript interfaces.
export CLEAN=true

export docker_compose_yaml=docker-compose-dev.yaml
export mvn_profile=dev

export MONGO_BASE=/home/clay/ferguson
export QUANTA_BASE=/home/clay/quanta-localhost-dev

