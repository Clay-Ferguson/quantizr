#!/bin/bash

if [ -z "$quanta_domain" ]
then
      echo "\$quanta_domain is empty. Don't run this batch file directly. It's run from other files."
      sleep 6
      exit
fi

clear
source ./setenv.sh
source ./define-functions.sh
# Note: This 'secrets.sh' script is my way of setting password environment varible from a secure location
source ${SECRET_SCRIPT}

cd /home/clay/ferguson/subnode-run
sudo ./stop.sh

cd $PRJROOT
docker-compose -f docker-compose-test.yaml down --remove-orphans
verifySuccess "Docker Compose (test): down"

cd $PRJROOT
docker-compose -f docker-compose-dev.yaml down --remove-orphans
verifySuccess "Docker Compose (dev): down"

# Wipe some existing stuff to ensure with certainty it gets rebuilt
rm -rf ~/ferguson/scripts/linode/${quanta_domain}/subnode-prod.tar
rm -rf $PRJROOT/target/*
rm -rf $PRJROOT/bin/*
rm -rf $PRJROOT/src/main/resources/public/bundle.js

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

# This run is required only to ensure TypeScript generated files are up to date.
mvn package -DskipTests -Pdev-vscode

# This build command creates the SpringBoot fat jar in the /target/ folder.
mvn clean package -Pprod -DskipTests=true
verifySuccess "Maven Build"

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
docker-compose -f docker-compose-prod.yaml build --no-cache
verifySuccess "Docker Compose: build"

# save the docker image into a TAR file so that we can send it up to the remote Linode server
# which can then on the remote server be loaded into registry for user on that host using the following command:
#     docker load -i <path to image tar file>
#
docker save -o ~/ferguson/scripts/linode/${quanta_domain}/subnode-prod.tar subnode-prod
verifySuccess "Docker Save"

read -p "Build Complete."
