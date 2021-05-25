#!/bin/bash

source ./setenv-distro-runner.sh

dockerDown quanta-distro
dockerDown mongo-distro

echo "All down."
sleep 2