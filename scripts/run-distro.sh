#!/bin/bash

source ./setenv--distro.sh

docker-compose -f ${docker_compose_yaml} down --remove-orphans
verifySuccess "Docker Compose: down"

sudo chown 999:999 ./mongod.conf

# sudo docker ps
# read -p "Verify no instances up. Press any key."

echo "removing logs"
rm -rf ./log/*

docker load -i ./quanta-distro.tar
verifySuccess "Docker Load quanta-distro.tar"

# IMPORTANT: Use this to troubeshoot the variable substitutions in the yaml file
# docker-compose -f ${docker_compose_yaml} config
# read -p "Config look ok?"

docker-compose -f ${docker_compose_yaml} up -d quanta-distro
verifySuccess "Docker Compose: up"

# sleep 10
# echp "Sleeping 10 seconds before checking logs"
# docker-compose -f ${docker_compose_yaml} logs ipfs-test
# verifySuccess "Docker Compose: logs"

dockerCheck "quanta-distro"

echo ===========================
echo Quantizr Distro Started OK!
echo ===========================

