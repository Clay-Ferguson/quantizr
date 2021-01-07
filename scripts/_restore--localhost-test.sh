#!/bin/bash

# WARNING: This is not run directly but run thru the docker command that runs scripts on docker images.
# See /home/clay/ferguson/scripts/backup/*

# Leave this full path (this is a volume mapping)
source /mongo-dumps/secrets.sh

mongorestore --username=root --password=${subnodePassword} --authenticationDatabase=admin \
    --host=mongo-test --port=27017 --gzip --drop --stopOnError --objcheck --verbose \
    --archive="/mongo-dumps/dump-to-restore.gz"    

# todo: check return code here!
echo "mongorestore complete!"
sleep 5
