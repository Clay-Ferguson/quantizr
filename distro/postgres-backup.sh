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
IMAGE_NAME="postgres"

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

export PGPASSWORD='${pgPassword}'
# NOTE: This will fail because it's running in a sort of local shell at least insofaras the ">" is concerned and so 
# it fails to find the /backup/ folder locally
# docker exec "$CONTAINER_ID" pg_dump -U quanta-pg -F c pgdb-distro > "/backup/postgres-"`eval date +%Y-%m-%d-%s`".dump"

# This works because it's running the command in a shell on the container
docker exec "$CONTAINER_ID" sh -c "pg_dump -U quanta-pg -F c quanta-pg > /backup/postgres-$(date +%Y-%m-%d-%s).dump"
unset PGPASSWORD

