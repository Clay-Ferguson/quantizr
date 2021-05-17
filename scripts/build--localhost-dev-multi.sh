#!/bin/bash
# see: https://quanta.wiki/n/localhost-fediverse-testing

# Multi-Instance (Federated) Development
#
# NOTE: This is the same kind of build as 'build--localhost-dev.sh' but this one starts 
# two separate instances of the app, for testing Fediverse functionality
#
# 

cwd=$(pwd)
if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi
. ./build--localhost-dev1.sh

cd $cwd
echo "===================================="
echo "Starting Second Instance Deploy."
echo "===================================="

# read -p "About to start second instance. Connect debugger now if you need to... (press any key)"

if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi
. ./build--localhost-dev2.sh

# read -p "Build and Multi-Start Complete. press a key"

# cd ${SCRIPTS}
# . ./activity-pub-check.sh
