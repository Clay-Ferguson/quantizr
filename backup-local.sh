#!/bin/bash

# NOTE: This is not called directly, but indirectly thru 'mongodb-backup.sh', and this script also
# gets moved to the place where it is in the shared directory visible to the mongodb docker container and
# also runs inside the docker container. mongodump isn't even available outside the mongo docker container also.

mongodump --port 27017 --gzip --archive="/mongo-dumps/dump-"`eval date +%Y-%m-%d-%s`".gz" --verbose

#https://docs.mongodb.com/manual/reference/program/mongoexport
#The best way to export human-readable text of the entire DB
mongoexport -v --pretty --port=27017 --collection=nodes --db=database --out="/mongo-dumps/nodes-"`eval date +%Y-%m-%d-%s`".json"

# todo: check return code here!
echo "mongodump complete!"
sleep 5
