#!/bin/bash

if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

clear
# show commands as they are run.
# set -x

source ./setenv--localhost-dev1.sh
sudo rm -rf ${QUANTA_BASE}/log/*

# go back to folder with this script in it. sort of 'home' for this script
cd $PRJROOT

# NOTE: Use 'compiler:compile' to shave off a couple of seconds faster than just 'compile' as the goal, because if you 
# use the compiler:compile it keeps even the compile phase from looking at any resources, and this is safe if you know
# the only files you have touched were Java Source files and no properties files for example.

mvn --offline compiler:compile -DskipTests=true -Pjava-compile

docker restart quanta-dev1
verifySuccess "Docker Restart quanta-dev1"

cd ${SCRIPTS}
source ./setenv--localhost-dev2.sh
# NOTE: This QUANTA_BASE will be different from the one we ran above. This is server #2
sudo rm -rf ${QUANTA_BASE}/log/*
cd $PRJROOT

echo "Wait for server 1 to start..."
sleep 30

# read -p "About to start second instance. Connect debugger now if you need to... (press any key)"

docker restart quanta-dev2
verifySuccess "Docker Restart quanta-dev2"

echo "Wait for server 2 to start..."
sleep 30

# cd ${SCRIPTS}
# . ./activity-pub-check.sh


