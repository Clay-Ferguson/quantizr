#!/bin/bash

echo "Warning! This wipes all your docker images!"
read -p "Press any key."

# sudo -i
docker image prune --all
docker system prune -a

read -p "done."