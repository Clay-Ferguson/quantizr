#!/bin/bash

source ./setenv--distro.sh

# to publish, first login (signup here if needed: https://hub.docker.com)
docker login

# tag the image with a version number
# (looks like if we create it initially with 'build' and give it a tag we won't need this)
#    docker tag imageJustBuildAbove subnode/repo:quanta${QUANTA_VER}

# now push it up to public docker repo!
docker push subnode/repo:quanta${QUANTA_VER}

read -p "Docker push complete: subnode/repo:quanta${QUANTA_VER} press a key."