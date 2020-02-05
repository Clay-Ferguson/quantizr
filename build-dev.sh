#!/bin/bash
clear
source ./setenv.sh
source ./define-functions.sh

CLEAN=false

# Ensure output folder for out docier images exists
mkdir -p ${ipfs_staging}

# Wipe some existing stuff to ensure it gets rebuilt
if [ "$CLEAN" == "true" ]; then
    rm -rf $PRJROOT/target/*
    rm -rf $PRJROOT/bin/*
fi

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

./pom-generate.sh

# This build command creates the SpringBoot fat jar in the /target/ folder.
if [ "$CLEAN" == "true" ]; then
    # This run is required basically only to ensure TypeScript generated files are up to date.
    mvn package -DskipTests -Pdev-vscode

    # Then this is the actual full build.
    mvn clean package -Pdev -DskipTests=true
else
    mvn package -Pdev -DskipTests=true
fi
verifySuccess "Maven Build"

# Note: This 'secrets.sh' script is my way of setting ${subnodePassword} environment varible from a secure location
source ${SECRET_SCRIPT}
cd $PRJROOT

# Remove all prior existing log files
rm -f ${SUBNODE_LOG_FOLDER}/*

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

docker-compose -f docker-compose-dev.yaml down --remove-orphans
verifySuccess "Docker Compose: down"

# I was seeing docker fail to deploy new code EVEN after I'm sure i built new code, and ended up finding
# this stackoverflow saying how to work around this (i.e. solution is first do the 'build' and then do 'up') 
# https://stackoverflow.com/questions/35231362/dockerfile-and-docker-compose-not-updating-with-new-instructions

docker-compose -f docker-compose-dev.yaml build --no-cache
verifySuccess "Docker Compose: build"

docker-compose -f docker-compose-dev.yaml up -d
verifySuccess "Docker Compose: up"

if docker ps | grep subnode-dev; then
    echo "subnode-dev successfully started"
else
    echo "subnode-dev failed to start"
fi
