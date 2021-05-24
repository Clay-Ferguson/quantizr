#!/bin/bash

# ===================================================================
# Starts the Quanta server at: http://${quanta_domain}:${PORT}
# The only prerequisite for the machine is: docker & docker-compose
# Docker References: https://docs.docker.com/compose/install/
# ===================================================================

source ./setenv--distro-runner.sh

./stop-distro.sh

echo "removing logs"
rm -rf ./log/*

# Uncomment this to troubeshoot the variable substitutions in the yaml file, and will
# display a copy of the yaml file after all environment variables have been substituted/evaluated
# docker-compose -f ${docker_compose_yaml} config
# read -p "Config look ok?"

docker-compose -version
dockerBuildUp

dockerCheck quanta-distro
dockerCheck mongo-distro

# docker-compose -f ${docker_compose_yaml} logs --tail="all" quanta-distro

echo ================================================
echo Quanta Distro Started OK!
echo http://${quanta_domain}:${PORT}
echo ================================================
read -p "Press any key."
