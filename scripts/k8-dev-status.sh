#!/bin/bash

minikube kubectl -- get po

minikube kubectl -- get svc

# this didn't seem to work...
# minikube kubectl -- describe quanta-dev

read -p "done. press any key"