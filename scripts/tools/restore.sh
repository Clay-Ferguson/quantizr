#!/bin/bash

docker exec -it mongo-prod /dumps/_restore.sh

read -p "mongorestore complete!  Press any key"
