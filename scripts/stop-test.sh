#!/bin/bash

cd /home/clay/ferguson/subnode-run

source ./setenv--localhost-test.sh

cd ${DEPLOY_TARGET}
dockerDown quanta-test
dockerDown mongo-test
