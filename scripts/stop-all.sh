#!/bin/bash

docker stack rm quanta-stack-dev
docker stack rm quanta-stack-distro
docker stack rm quanta-stack-local

read -p "Press ENTER"