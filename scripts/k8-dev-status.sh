#!/bin/bash

# this alias doesn't work for some reason
# alias kubectl="minikube kubectl --"

# show commands as they are run.
set -x

POD_NAME=mongo-dev-7b57857764-7rr49

minikube kubectl -- get po

echo "___________________________________________________________"

# learning how to view pod logs...
# minikube kubectl -- logs --help
minikube kubectl -- logs $POD_NAME
exit

echo "___________________________________________________________"

minikube kubectl -- get svc

echo "___________________________________________________________"

minikube kubectl -- describe pod $POD_NAME

echo "___________________________________________________________"

read -p "done. press any key"