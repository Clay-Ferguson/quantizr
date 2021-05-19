#!/bin/bash

# ===================================================================
# Starts the Quanta server at: http://localhost:8185
# The only prerequisite for the machine is: docker & docker-compose
# Docker References: https://docs.docker.com/compose/install/
# ===================================================================

source ./setenv--distro-runner.sh

./stop-distro.sh

echo "removing logs"
rm -rf ./log/*

# IMPORTANT: Use this to troubeshoot the variable substitutions in the yaml file
# docker-compose -f ${docker_compose_yaml} config
# read -p "Config look ok?"

docker-compose -version
dockerBuildUp

dockerCheck quanta-distro
dockerCheck mongo-distro

echo ================================================
echo Quanta Distro Started OK!
echo http://localhost:8185
echo ================================================
read -p "Press any key."
