#!/bin/bash

# NOTE: This script runs the backup-local.sh script
# which runs INSIDE the docker container, and has access to the mongodump
# utility which is a tool that can be done to back the DB without stopping the service.

docker exec mongo-test /mongo-dumps/_backup--localhost-test.sh

read -p "Mongo Dump complete"