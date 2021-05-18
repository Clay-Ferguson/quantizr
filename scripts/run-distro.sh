#!/bin/bash

source ./setenv--distro.sh

dockerDown

# I don't remember why I had originally done this chown but I'm glad it no longer appears to be needed.
# sudo chown 999:999 ./mongod.conf

# sudo docker ps
# read -p "Verify no instances up. Press any key."

echo "removing logs"
rm -rf ./log/*

# IMPORTANT: Use this to troubeshoot the variable substitutions in the yaml file
# docker-compose -f ${docker_compose_yaml} config
# read -p "Config look ok?"

dockerBuildUp quanta-distro

echo ===========================
echo Quantizr Distro Started OK!
echo ===========================
