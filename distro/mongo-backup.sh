#!/bin/bash

source setenv-run-distro.sh

# first apply any overrides that exist in this folder
if [ -f "setenv-quanta-ext.sh" ]; then
    echo "Overriding secrets with setenv-quanta-ext.sh"
    source setenv-quanta-ext.sh
fi

# then apply any overrides from parent folder
if [ -f "../setenv-quanta-ext.sh" ]; then
    echo "Overriding secrets with ../setenv-quanta-ext.sh"
    source ../setenv-quanta-ext.sh
fi

# Set the image name
IMAGE_NAME="mongo:6.0.8"

# Get the container ID based on the image name
CONTAINER_ID=$(docker ps --format "{{.ID}} {{.Image}}" | grep "$IMAGE_NAME" | awk '{print $1}')
# NOTE: THIS IS THE CORRECT WAY TO GET CONTAINER_ID (note the wildcard)
# CONTAINER_ID=$(docker ps -q -f name=SomeNamePrefix*)

# Check if a container was found
if [ -z "$CONTAINER_ID" ]; then
  echo "No container found for image: $IMAGE_NAME"
  exit 1
fi

echo "Container ID: $CONTAINER_ID"

# Execute the backup script inside the container
docker exec "$CONTAINER_ID" mongodump --username=root --password=${mongoPassword} --authenticationDatabase=admin \
    --host=${MONGO_HOST} --port=${MONGO_PORT} --gzip --archive="/backup/dump-"`eval date +%Y-%m-%d-%s`".gz" --verbose

# https://docs.mongodb.com/manual/reference/program/mongoexport
#The best way to export human-readable text of the entire DB
#mongoexport -v --pretty --username=root --password=??? --authenticationDatabase=admin \
#    --host=${MONGO_HOST} --port=${MONGO_PORT} --collection=nodes --db=database --out="/backup/nodes-"`eval date +%Y-%m-%d-%s`".json"

# example restore:
# mongorestore --username=root --password=${adminPassword} --authenticationDatabase=admin \
#     --host=${MONGO_HOST} --port=${MONGO_PORT} --gzip --drop --stopOnError --objcheck --verbose \
#     --archive="/backup/dump-to-restore.gz"
