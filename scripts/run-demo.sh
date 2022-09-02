#!/bin/bash

# IMPORTANT:
# Edit QUANTA_VER in setenv-run-distro.sh to match the zip file in the distro folder.
#   todo-0: explain this more clearly.

THIS_FILE=$(readlink -f "$0")
THIS_FOLDER=$(dirname "$THIS_FILE")
cd ${THIS_FOLDER}

source ./setenv-run-distro.sh

# If you're just trying out Quanta, and want to verify that you can run it, in the simplest way possible 
# you can just run this script, and it should all be automatic and result in a running instance.

tar -xf ../distro/quanta${QUANTA_VER}.tar.gz
