#!/bin/bash
# This script is for recompiling just the Java files, and then restarting the test servers,
# as fast as possible without doing a full build. Note that our dev project is setup to read
# java class files directly from disk, so we don't even need to really do an actual build, and
# we can get away with just compiling the new classes, and then restarting docker!
# This makes for a very rapid development cycle (edit->test->edit->test, etc.)

clear
# show commands as they are run.
# set -x

# ==========
# Server #1
# ==========
source ./setenv-dev1.sh
sudo rm -rf ${QUANTA_BASE}/log/*

# go back to folder with this script in it. sort of 'home' for this script
cd $PRJROOT

# NOTE: Use 'compiler:compile' to shave off a couple of seconds faster than just 'compile' as the goal, because if you 
# use the compiler:compile it keeps even the compile phase from looking at any resources, and this is safe if you know
# the only files you have touched were Java Source files and no properties files for example.

mvn --offline compiler:compile -DskipTests=true -Pjava-compile

docker-compose -f ${dc_app_yaml} restart quanta-dev1
verifySuccess "Docker Restart quanta-dev1"

# ==========
# Server #2
# ==========
cd ${SCRIPTS}
source ./setenv-dev2.sh
# NOTE: This QUANTA_BASE will be different from the one we ran above. This is server #2
sudo rm -rf ${QUANTA_BASE}/log/*
cd $PRJROOT

# read -p "About to start second instance. Connect debugger now if you need to... (press any key)"

docker-compose -f ${dc_app_yaml} restart quanta-dev2
verifySuccess "Docker Restart quanta-dev2"

echo "wait for servers to start..."
sleep 30

cd ${SCRIPTS}
. ./activity-pub-check.sh


