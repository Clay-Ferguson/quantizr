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
export RESTART_MONGODB=true
export RESTART_IPFS=true

CLEAN=false
# =====================================================

# Ensure output folder for out docier images exists
mkdir -p $DOCKER_IMAGES_FOLDER
mkdir -p ${ipfs_staging}

# Wipe some existing stuff to ensure it gets rebuilt
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

# If building 'prod', we save the docker image into a TAR file so that we can send it up to the remote Linode server
# which can then on the remote server be loaded into registry for user on that host using the following command:
#     docker load -i <path to image tar file>
#
if [ "$MAVEN_PROFILE" == "prod" ]; then
    echo "prod path not yet ready, after transition to docker-compose"
    exit 0
    docker save -o $DOCKER_IMAGES_FOLDER/subnode-0.0.1.tar subnode-0.0.1
    verifySuccess "Docker Save"
fi

# If we're doing a dev build, we want to go ahead and run the docker images immediately.
# This starts MongoDB, IPFS, and Quantizr containers
if [ "$MAVEN_PROFILE" == "dev" ]; then    
    # Note: This 'secrets.sh' script is my way of setting ${subnodePassword} environment varible from a secure location
    source ${SECRET_SCRIPT}
    cd $PRJROOT

    # Stop/Remove IPFS instance 
    if [ "$RESTART_IPFS" == "true" ]; then
        echo Removing IPFS
        docker rm -f ipfs_host_dev -f || true
    fi

    # Stop/Remove Quantizr instance 
    echo Stopping Quantizr
    docker rm -f subnode_dev -f || true

    # Stop/Remove MongoDB instance 
    if [ "$RESTART_MONGODB" == "true" ]; then
        echo Removing MongoDB
        docker rm -f subnode_mongo_dev -f || true
    fi

    # Remove all prior existing log files
    rm -f ${SUBNODE_LOG_FOLDER}/*

    cd $PRJROOT

    #
    # NOTE: The 'dev-resource-base' in the run command below sets up a property (resourceBaseFolder)
    # which allows Spring to load resources directly from the specified folder in a way that it overrides
    # the built in resources deployed into docker. This allows us to then edit LESS, HTML, or TS files
    # and then simply by running the maven command: "mvn generate-resources -DskipTests -Pwebpack"
    # which you can find in (.vscode/tasks.json), it allows is to then see those chagnes LIVE in the deployed
    # web app without doing a full build/redeploy. 
    #
    #   Use these additional options to enable HTTPS.
    #   -p 443:443 \
    #   "--server.port=443" \
    # 	"--security.require-ssl=true" \
    # 	"--server.ssl.key-store=classpath:keystore.p12" \
    # 	"--server.ssl.key-store-password=????" \
    # 	"--server.ssl.keyStoreType=PKCS12" \
    # 	"--server.ssl.keyAlias=tomcat" \
    # 	"--httpProtocol=https" \
    #
    #   "--forceIndexRebuild=true" \
    ################################################################################################

    # I was seeing docker fail to deploy new code EVEN after I'm sure i built new code, and ended up findingn
    # this stackoverflow saying how to work around this (i.e. first 'build' then 'up') 
    # https://stackoverflow.com/questions/35231362/dockerfile-and-docker-compose-not-updating-with-new-instructions
    docker-compose -f docker-compose-dev.yaml build --no-cache
    verifySuccess "Docker Compose: build"

    docker-compose -f docker-compose-dev.yaml up -d
    verifySuccess "Docker Compose: up"

    if docker ps | grep subnode-0.0.1; then
        echo "subnode-0.0.1 successfully started"
    else
        echo "subnode-0.0.1 failed to start"
    fi

#########################################
fi

# We do prod builds from an OS terminal so we want to pause to show a message.
if [ "$MAVEN_PROFILE" == "prod" ]; then
    read -p "All Done!  Press any key"
fi
