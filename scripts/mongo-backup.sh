#!/bin/bash

# Set the image name
IMAGE_NAME="mongo:6.0.8"

# Get the container ID based on the image name
CONTAINER_ID=$(docker ps --format "{{.ID}} {{.Image}}" | grep "$IMAGE_NAME" | awk '{print $1}')

# Check if a container was found
if [ -z "$CONTAINER_ID" ]; then
  echo "No container found for image: $IMAGE_NAME"
  exit 1
fi

echo "Container ID: $CONTAINER_ID"

# Execute the backup script inside the container
docker exec "$CONTAINER_ID" /backup/_backup.sh
