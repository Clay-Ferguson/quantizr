#!/bin/bash

# Warning: The filename 'run-test.sh' is admittedly confusing. This script does NOT run tests. 
# It runs the app itself in 'test' environment.

if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

cd /home/clay/ferguson/subnode-run

source ./setenv--localhost-test.sh

# sudo chown 999:999 ${SECRETS}/mongod.conf

# sudo docker ps
# read -p "Verify no instances up. Press any key."

echo "removing logs"
rm -f ./log/*

# IMPORTANT: Use this to troubeshoot the variable substitutions in the yaml file
# docker-compose -f ${docker_compose_yaml} config
# read -p "Config look ok?"

dockerBuildUp quanta-test

echo ==========================
echo Quantizr Started OK!
echo ==========================
read -p "Press any key"
