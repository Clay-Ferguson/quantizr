#!/bin/bash

# Tries to run the files in your last built distro folder. This is the same folder that's zipped to make an actual
# binary release distro 

# NOTE: If you don't know why this vscode-cwd.sh is here then you can ignore it. This script being run here
# only contains a command to change to the [project]/scripts/ direcory when it's run from inside VSCode
# so if you are running this builder outside of VSCode terminal you can ignoure this 'vscode-cwd.sh' stuff 
if [ -f ./vscode-cwd.sh ]; then
  source ./vscode-cwd.sh
fi

source ./setenv--distro.sh

cd ${DEPLOY_TARGET}
sudo ./run-distro.sh
