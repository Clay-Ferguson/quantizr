#!/bin/bash

clear
# show commands as they are run.
# set -x

source ./setenv-dev.sh

# go back to folder with this script in it. sort of 'home' for this script
cd $PRJROOT

# NOTE: Use 'compiler:compile' to shave off a couple of seconds faster than just 'compile' as the goal, because if you 
# use the compiler:compile it keeps even the compile phase from looking at any resources, and this is safe if you know
# the only files you have touched were Java Source files and no properties files for example.

mvn --offline compiler:compile -DskipTests=true -Pjava-compile

sudo rm -rf ${QUANTA_BASE}/log/*

# NOTE: --compatibility switch is required for the CPUS limitier to work,
# in a non-swarm docker setup, which we have
docker-compose --compatibility -f ${docker_compose_yaml} restart quanta-dev

# This is another way, but slower. Not needed.
# dockerDown ${docker_compose_yaml} quanta-dev
# sudo rm -rf ${QUANTA_BASE}/log/*
# dockerBuild
# dockerUp

verifySuccess "Docker Restart"
