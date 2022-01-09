#!/bin/bash

# NOTES 
# - Be sure minkube is running first (see: k8-start-minikube.sh)
# - Run `minkkube tunnel` in a separate dedicated terminal and leave the terminal up to make your 
#   LoadBalancer types have a working EXTERNAL-IP, or else the external IP will be stuck in 'pending' status.
# - login to container instance with `minikube ssh`

# force current dir to be this script
script_file=$(realpath $0)
script_folder="$(dirname "${script_file}")"
cd ${script_folder}

# show commands as they are run.
# set -x
source ./setenv-dev.sh

eval $(minikube docker-env)

cd ${PRJROOT}
# minikube kubectl -- apply -f k8-dev-app.yaml
# minikube kubectl -- apply -f k8-dev-mongo.yaml,k8-dev-app.yaml
minikube kubectl -- apply -f k8-dev-mongo.yaml

read -p "done. press any key"