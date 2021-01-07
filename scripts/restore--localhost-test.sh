#!/bin/bash

# Tip: Remember the mongo-dumps is a volume mapping in the yaml, that controls the 'real' host directory where the restore-local.sh is
docker exec -it mongo-test /mongo-dumps/_restore--localhost-test.sh

read -p "mongorestore complete!  Press any key"
