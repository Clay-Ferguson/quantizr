#!/bin/bash

# Starts the app without doing any build. Just uses current image and YAML settings.

clear
# show commands as they are run.
# set -x

source ./setenv-dev.sh

cd ${PRJROOT}
dockerUp

printUrlsMessage


