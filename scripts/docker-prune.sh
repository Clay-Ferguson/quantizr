#!/bin/bash

echo "Warning! This wipes all your docker images!"
read -p "Press ENTER key."

# sudo -i
docker image prune --all
docker system prune -a

read -p "done."