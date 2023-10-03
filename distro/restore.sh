#!/bin/bash
docker exec -it mongo-distro /backup/_restore.sh
read -p "mongorestore complete!  Press ENTER key"
