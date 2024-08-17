#!/bin/bash

# This script is for recompiling just the Java files, and then restarting the already running dev server
# as fast as possible without doing a full build (only a compile). Note that our dev project is setup to read
# java class files directly from disk, so we don't even need to really do an actual build, and
# we can get away with just compiling the new classes, and then restarting docker!
# This makes for a very rapid development cycle (edit->test->edit->test, etc.)

clear
# show commands as they are run.
# set -x

source ./setenv-dev.sh

# go back to folder with this script in it. sort of 'home' for this script
cd $PRJROOT

# NOTE: Use 'compiler:compile' to shave off a couple of seconds faster than just 'compile' as the goal, because if you 
# use the compiler:compile it keeps even the compile phase from looking at any resources, and this is safe if you know
# the only files you have touched were Java Source files and no properties files for example.

mvn -T 1C --offline compiler:compile -DskipTests=true -Pjava-compile

sudo rm -rf ${QUANTA_BASE}/log/*

# Copy our primary logger file out to the live-loadable confured location
# (note: without the 'logging.config' being set in the docker yaml this file would
# load right from /src/mai/resouces which is the spring default location.)
cp ${PRJROOT}/src/main/resources/logback-spring.xml ${QUANTA_BASE}/log/logback.xml

docker service update --force quanta-stack-dev_quanta-dev

verifySuccess "Docker Service Update"
