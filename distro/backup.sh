#!/bin/bash
docker exec mongo-distro /dumps/_backup.sh
read -p "All done. Press ENTER"