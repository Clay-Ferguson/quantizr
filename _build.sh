#!/bin/bash

# show commands as they are run.
# set -x

if [ -z "$quanta_domain" ]
then
    read -p "\$quanta_domain is empty. Don't run this batch file directly. It's run from a 'build--*.sh' file"
    exit
fi

# Wipe some existing stuff to ensure it gets rebuilt
if [ "$CLEAN" == "true" ]; then
    rm -rf ${PRJROOT}/target/*
    rm -rf ${PRJROOT}/bin/*
fi

rm -rf ${PRJROOT}/src/main/resources/public/bundle.js

# Run ignore-scripts for some security from NodeJS
cd ${PRJROOT}/src/main/resources/public
npm config set ignore-scripts true

cd ${PRJROOT}
./run-linter.sh
verifySuccess "Linter"

cd ${PRJROOT}
docker-compose -f ${docker_compose_yaml} down --remove-orphans
verifySuccess "Docker Compose: down"

# Generate 'pom.xml' dynamically from file parts
./pom-generate.sh

# These aren't normally needed, so I'll just keep commented out most of time. 
# mvn dependency:sources
# mvn dependency:resolve -Dclassifier=javadoc
# mvn dependency:tree clean exec:exec package -DskipTests=true -Dverbose

# This build command creates the SpringBoot fat jar in the /target/ folder.
# Note: If CLEAN is false we're going for the fastest possible build.
if [ "$CLEAN" == "true" ]; then
    # This run is required only to ensure TypeScript generated files are up to date.
    # Always do the same profile here (pdev-vscode)
    mvn package -DskipTests=true -Pdev-vscode

    # Then this is the actual full build.
    mvn clean package -DskipTests=true -P${mvn_profile}
else
    mvn --offline package -DskipTests=true -P${mvn_profile} 
fi
verifySuccess "Maven Build"

################################################################################################
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


# IMPORTANT: Use this to troubeshoot the variable substitutions in the yaml file
# docker-compose -f ${docker_compose_yaml} config 
# read -p "Config look ok?"

# I was seeing docker fail to deploy new code EVEN after I'm sure i built new code, and ended up findingn
# this stackoverflow saying how to work around this (i.e. first 'build' then 'up') 
# https://stackoverflow.com/questions/35231362/dockerfile-and-docker-compose-not-updating-with-new-instructions
docker-compose -f ${docker_compose_yaml} build --no-cache
verifySuccess "Docker Compose: build"
