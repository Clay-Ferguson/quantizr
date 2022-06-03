#!/bin/bash
# see: https://quanta.wiki/n/localhost-fediverse-testing

# Builder for Multi-Instance (Federated) Development
#
# NOTE: This is the same kind of build as 'build-dev.sh' but this one starts 
# two separate instances of the app, for testing Fediverse functionality, or for
# testing load-balancer functionality
#

# Make the folder holding this script become the current working directory
SCRIPT=$(readlink -f "$0")
SCRIPTPATH=$(dirname "$SCRIPT")
echo "cd $SCRIPTPATH"
cd "$SCRIPTPATH"

echo "========================================"
echo "Starting Server #1 Instance Build+Deploy"
echo "========================================"

#save stating folder
cwd=$(pwd)

. ./build-dev1.sh

#restore starting folder
cd $cwd 

echo "========================================"
echo "Starting Server #2 Instance Deploy"
echo "========================================"

# read -p "About to start second instance. Connect debugger now if you need to... (press any key)"

. ./build-dev2.sh

# read -p "Build and Multi-Start Complete. press a key"

# cd ${SCRIPTS}
# . ./activity-pub-check.sh
