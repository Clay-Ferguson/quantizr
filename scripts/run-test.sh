#!/bin/bash

# Warning: The filename 'run-test.sh' is admittedly confusing. This script does NOT run tests. 
# It runs the app itself in 'test' environment.

cd /home/clay/ferguson/subnode-run

source ./setenv--localhost-test.sh

./stop-test.sh

echo "removing logs and tmp files"
rm -rf ./log/*
rm -rf ./tmp/*

# IMPORTANT: Use this to troubeshoot the variable substitutions in the yaml file
# docker-compose -f ${docker_compose_yaml} config
# read -p "Config look ok?"

dockerBuildUp

dockerCheck quanta-test
dockerCheck mongo-test

echo ==========================
echo Quanta Started OK!
echo ==========================
read -p "Press any key"
