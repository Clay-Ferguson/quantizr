#!/bin/bash

# NOTE: First run 'build-distro.sh' before running this.

source ./setenv-build-distro.sh

# to publish, first login (signup here if needed: https://hub.docker.com)
docker login

docker push ${DOCKER_IMAGE}
echo "Docker pushe complete: ${DOCKER_IMAGE}"

docker push ${TSERVER_IMAGE}
echo "Docker pushe complete: ${TSERVER_IMAGE}"

read -p "done. press ENTER."
