#!/bin/bash

# force current dir to be this script
script_file=$(realpath $0)
script_folder="$(dirname "${script_file}")"
cd ${script_folder}

# show commands as they are run.
# set -x
source ./setenv-dev.sh

cd ${PRJROOT}
# eval $(minikube docker-env)
minikube kubectl -- apply -f k8-dev-app.yaml

read -p "done. press any key"