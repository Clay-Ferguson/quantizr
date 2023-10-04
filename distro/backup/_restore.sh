#!/bin/bash
# NOTE: This script is not run directly but run thru the docker command that runs scripts on docker images.

echo "you need to hand edit all the paths in this script to match your environment"
exit

mongorestore --username=root --password=${adminPassword} --authenticationDatabase=admin \
    --host=${MONGO_HOST} --port=${MONGO_PORT} --gzip --drop --stopOnError --objcheck --verbose \
    --archive="/backup/dump-to-restore.gz"

# todo: check return code here!
echo "mongorestore complete!"
sleep 5
