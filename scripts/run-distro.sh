#!/bin/bash

source ./setenv--distro.sh

./stop-distro.sh

echo "removing logs"
rm -rf ./log/*

# IMPORTANT: Use this to troubeshoot the variable substitutions in the yaml file
# docker-compose -f ${docker_compose_yaml} config
# read -p "Config look ok?"

dockerBuildUp

dockerCheck quanta-distro
dockerCheck mongo-distro

echo ===========================
echo Quanta Distro Started OK!
echo ===========================
