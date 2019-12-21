#!/bin/bash
#################################################################
#
# NOTE: Normally we don't run this script directly, but it's run indirectly
#       when 'build.sh' calls it.
#
# This is a script for use during development. It will run the web
# app at http port 8181, and sets up a debugging port at 8000, and also
# takes care of making sure MongoDb docker container is also up and running
# before it starts whe SubNode web app. Also IPFS docker will be started
# if we have it configured to run IPFS.
# 
#################################################################
source ./setenv.sh
source ./define-functions.sh

# Note: This 'secrets.sh' script is my way of setting ${subnodeAESKey} and ${subnodePassword} environment varibles (and that's ALL it does), 
# so anyone else would want to just make their own secrets file, and call it instead, or do whatever you want. You could also hard code values 
# into this script and that would also work just fine too of course.
source ${SECRET_SCRIPT}
cd $PRJROOT

# Stop/Remove IPFS instance 
if [ "$RESTART_IPFS" == "true" ]; then
    echo Removing IPFS
    docker rm -f ipfs_host_dev -f || true
fi

# Stop/Remove Quantizr instance 
echo Stopping SubNode
docker rm -f subnode_dev -f || true

# Stop/Remove MongoDB instance 
if [ "$RESTART_MONGODB" == "true" ]; then
    echo Removing MongoDB
    docker rm -f subnode_mongo_dev -f || true
fi

# Remove all prior existing log files
rm -f ${SUBNODE_LOG_FOLDER}/*

# Start IPFS 
if [ "$RESTART_IPFS" == "true" ]; then
    ./docker-run-ipfs.sh
fi

# Start MongoDB
if [ "$RESTART_MONGODB" == "true" ]; then
    ./docker-run-mongo.sh
fi

cd $PRJROOT
# echo $subnodeAESKey
# echo $subnodePassword
# read -p "Do you see the two secret passwords above? They are required! Put in your environment (maybe /etc/environment)"

# NOTE: When you resume trying to get this 'subnode_net' working remember to also change the
# --mongodb.host=127.0.0.1 to be --mongodb.host=subnode_net, or at least that's what I had been trying. 
#docker network rm subnode_net
#docker network create --driver bridge subnode_net
#docker network ls
#read -p "Press a key if networks look ok."

#supposedly this starts a network only if not already started, so we can avoid the error when starting network if it's already started.
#docker network inspect subnode_net &>/dev/null || 
#    docker network create --driver bridge subnode_net

PORT=8182

#################################################################################################
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
################################################################p################################
#(-d=daemon -t=terminal)

# Start MongoDB, and pass in a bunch of params that override whatever's in application.properties.
docker run -d \
    --name subnode_dev \
    --network=host \
    --expose=${PORT} \
    -e "JAVA_TOOL_OPTIONS=\"-agentlib:jdwp=transport=dt_socket,address=8000,server=y,suspend=n\"" \
    -v ${SUBNODE_TMP_FOLDER}:/subnode-tmp \
    -v ${SUBNODE_LOG_FOLDER}:/subnode-log \
    -v ${SUBNODE_LUCENE_FOLDER}:/subnode-lucene \
    -v ${PRJROOT}/src/main/resources/public:/dev-resource-base \
    -p ${PORT}:${PORT} \
    -p 8000:8000 \
    subnode-0.0.1 \
    "-Xms512m" \
    "-Xmx2500m" \
    "--testUserAccounts=adam:password:${devEmail},bob:password:${devEmail},cory:password:${devEmail},dan:password:${devEmail}" \
    "--resourcesBaseFolder=file:///dev-resource-base/" \
    "--spring.config.location=classpath:/application.properties" \
    "--mongodb.host=127.0.0.1" \
    "--mongodb.port=27016" \
    "--profileName=dev" \
    "--server.port=${PORT}" \
 	"--httpProtocol=http" \
    "--metaHost=localhost" \
    "--allowFileSystemSearch=true" \
    "--spring.http.multipart.max-file-size=200MB" \
    "--spring.http.multipart.max-request-size=200MB" \
    "--aeskey=${subnodeAESKey}" \
    "--adminDataFolder=/subnode-tmp" \
    "--mongoAdminPassword=${subnodePassword}" \
    "--mail.user=postmaster@quantizr.com" \
	"--mail.password=${emailPassword}" \
	"--mail.host=smtp.mailgun.org" \
    "--mail.from=admin@quantizr.com"

verifySuccess "Docker Run (subnode_dev)"

if docker ps | grep subnode-0.0.1; then
    echo "subnode-0.0.1 successfully started"
else
    echo "subnode-0.0.1 failed to start"
fi
