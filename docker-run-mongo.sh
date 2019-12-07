#!/bin/bash
source ./setenv.sh
source ./define-functions.sh
#################################################################
#
# NOTE: Normally we don't run this script directly, but it's run indirectly
#       because 'build.sh' calls it indirectly.
#
#################################################################

# Quantizr app requires MongoDb for data persistence, and the current strategy is to run this
# script before running the docker-run-subnode.sh one, in order to get SubNode up and running.
# We might eventually want to put these two (mongo+subnode) in a Docker Compose file and run them
# bother together at once.

cd $PRJROOT

# tip: Use this command to find your existing mongodb location on a local machine if already installed:
#     grep dbPath /etc/mongod.conf
#     (The output of that command would go to the left of the colon, and then /data/db is always on the right regardless, because that's the VM folder)
#
# Note for -v arg, on the left of the colon is the real 'host' folder, and the right hand side never changes.
# Normally we have this DB folder: -v /var/lib/mongodb:/data/db \
docker run -d \
    --name subnode_mongo \
    --network=host \
    -v ${hostMongoDbPath}:/data/db \
    mongo \
    --port 27016

verifySuccess "Docker Run (mongo)"

if docker ps | grep subnode_mongo; then
    echo "MongoDb started successfully."
else 
    echo "MongoDb FAILED to restart."
fi


