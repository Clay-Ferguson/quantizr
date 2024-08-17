#!/bin/bash

# ===================================
# Copies Docker Images to Docker Hub
# ===================================
# NOTE: Before running this set version in 'set-version.sh', and then run 'build-distro.sh'.

source ./setenv-build-distro.sh

# to publish, first login (signup here if needed: https://hub.docker.com)
docker login

DOCKER_IMAGE_T=subnode/${DOCKER_IMAGE}:${QUANTA_VER}
docker tag ${DOCKER_IMAGE} ${DOCKER_IMAGE_T}
read -p "Tagged as ${DOCKER_IMAGE_T}"

docker push ${DOCKER_IMAGE_T}
echo "Docker push complete: ${DOCKER_IMAGE_T}"

read -p "done. press ENTER."
