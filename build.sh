#!/bin/bash
#######################################################
#
# This is the script I use (developer of SubNode) to build and redeploy
# the web app during development, by setting MAVEN_PROFILE="dev". When the profile
# is set to 'dev' running this script will not only build but will also redeploy and get the 
# web app up on port 8181 and with debugging port 8000 ready.
#
# Note, you can set CLEAN=false for the fastest possible build, when building for 'dev' profile.
# 
# This is ALSO the same script I use for doing the production build by manually
# editing the varible to MAVEN_PROFILE="prod", before running the script. If you set to 'prod' then 
# this script will only build the prod image, and not try to actually run anything.
#   
#######################################################
clear
source ./setenv.sh
source ./define-functions.sh

# =====================================================
# EDIT THESE VARS BEFORE RUNNING.
#
# Must be: dev or prod
MAVEN_PROFILE=dev

# NOTE: These need to both be true if you're running for the first time like since a machine reboot, because they 
# won't be running and without 'true' on these they won't be started.
export RESTART_MONGODB=false
export RESTART_IPFS=false

CLEAN=false
# =====================================================

# Ensure output folder for out docier images exists
mkdir -p $DOCKER_IMAGES_FOLDER

# Wipe some existing stuff to ensure it gets rebuild
rm -rf $DOCKER_IMAGES_FOLDER/subnode-0.0.1.tar
rm -rf $PRJROOT/target/*
rm -rf $PRJROOT/bin/*
rm -rf $PRJROOT/src/main/resources/public/bundle.js
rm -rf $PRJROOT/src/main/resources/public/index.html

# Run ignore-scripts for some security from NodeJS
cd $PRJROOT/src/main/resources/public
npm config set ignore-scripts true

# go back to folder with this script in it. sort of 'home' for this script
cd $PRJROOT

# These aren't normally needed, so I'll just keep commented out most of time. 
# mvn dependency:sources
# mvn dependency:resolve -Dclassifier=javadoc
# mvn dependency:tree clean exec:exec package -DskipTests=true -Dverbose

#For prod builds always force CLEAN
if [ "$MAVEN_PROFILE" == "prod" ]; then
    CLEAN=true
fi

# This build command creates the SpringBoot fat jar in the /target/ folder.
if [ "$CLEAN" == "true" ]; then
    mvn clean package -P$MAVEN_PROFILE -DskipTests=true
else
    mvn package -P$MAVEN_PROFILE -DskipTests=true
fi

verifySuccess "Maven Build"

# Builds a docker image to run the jar in the target folder. If you're not using Docker you can 
# just delete this line, and use the JAR and run it like a normal SpringBoot jar
docker build --tag=subnode-0.0.1 .

#apparently this command setting a fail exit code????
verifySuccess "Docker Build"

# If building 'prod', we save the docker image into a TAR file so that we can send it up to the remote Linode server
# which can then on the remote server be loaded into registry for user on that host using the following command:
#     docker load -i <path to image tar file>
if [ "$MAVEN_PROFILE" == "prod" ]; then
    docker save -o $DOCKER_IMAGES_FOLDER/subnode-0.0.1.tar subnode-0.0.1
    verifySuccess "Docker Save"
fi

# If we're doing a dev build, we want to go ahead and run the docker images immediately.
# This starts MongoDB, IPFS, and Quantizr as three separate docker instances.
# (Some day we can combine these into one using 'Docker Compose', but I haven't learned how to do that yet)
if [ "$MAVEN_PROFILE" == "dev" ]; then    
    ./docker-dev-run.sh
fi

# We do prod builds from an OS terminal so we want to pause to see how it went.
if [ "$MAVEN_PROFILE" == "prod" ]; then
    read -p "All Done!  Press any key"
fi
