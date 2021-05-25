#!/bin/bash

source ./setenv-distro-runner.sh

# NOTE: This is not run directly but run thru the docker command that runs scripts on docker images.

#The BEST way to export something that can be reimported easy to recreate the actual DB again.
mongodump --username=root --password=${subnodePassword} --authenticationDatabase=admin \
    --host=mongo-distro --port=${MONGO_PORT} --gzip --archive="/dumps/dump-"`eval date +%Y-%m-%d-%s`".gz" --verbose

#https://docs.mongodb.com/manual/reference/program/mongoexport
#The best way to export human-readable text of the entire DB
#mongoexport -v --pretty --username=root --password=??? --authenticationDatabase=admin \
#    --host=mongo-prod --port=27017 --collection=nodes --db=database --out="/dumps/nodes-"`eval date +%Y-%m-%d-%s`".json"

# todo: check return code here!
echo "mongodump complete!"
sleep 5
