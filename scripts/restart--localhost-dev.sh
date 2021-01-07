#!/bin/bash

if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

clear
# show commands as they are run.
set -x

source ./define-functions.sh
source ./setenv-common.sh
source ./setenv--localhost-dev.sh

# go back to folder with this script in it. sort of 'home' for this script
cd $PRJROOT

# NOTE: Use 'compiler:compile' to shave off a couple of seconds faster than just 'compile' as the goal, because if you 
# use the compiler:compile it keeps even the compile phase from looking at any resources, and this is safe if you know
# the only files you have touched were Java Source files and no properties files for example.

mvn --offline compiler:compile -DskipTests=true -Pjava-compile

docker restart subnode-dev
verifySuccess "Docker Restart"
