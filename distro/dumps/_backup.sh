#!/bin/bash
# NOTE: This script is not run directly but run thru the docker command that runs scripts on docker images.

echo "You should hand-enter the variables used in the command below."
exit

#The BEST way to export something that can be reimported easy to recreate the actual DB again.
mongodump --username=root --password=${mongoPassword} --authenticationDatabase=admin \
    --host=${MONGO_HOST} --port=${MONGO_PORT} --gzip --archive="/dumps/dump-"`eval date +%Y-%m-%d-%s`".gz" --verbose

#https://docs.mongodb.com/manual/reference/program/mongoexport
#The best way to export human-readable text of the entire DB
#mongoexport -v --pretty --username=root --password=??? --authenticationDatabase=admin \
#    --host=${MONGO_HOST} --port=${MONGO_PORT} --collection=nodes --db=database --out="/dumps/nodes-"`eval date +%Y-%m-%d-%s`".json"

# todo: check return code here!
echo "mongodump complete!"
sleep 5
