#!/bin/bash

docker stop $(docker ps -a -q)
docker rm $(docker ps -a -q)

read -p "All docker images should be gone."
