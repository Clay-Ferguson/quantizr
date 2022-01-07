#!/bin/bash

minikube kubectl -- get po
minikube kubectl -- get svc

read -p "done. press any key"