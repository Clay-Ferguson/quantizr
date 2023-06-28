#!/bin/bash
docker exec -it mongo-distro /dumps/_restore.sh
read -p "mongorestore complete!  Press ENTER key"
