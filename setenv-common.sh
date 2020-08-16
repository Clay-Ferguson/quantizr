#!/bin/bash

# see /docs/how-to-build.md for details on what this script must contain.
source /home/clay/ferguson/secrets/secrets.sh

# Directory that contains the Quanta project (pom.xml is here, for example). 
export PRJROOT=/home/clay/ferguson/Quantizr

# Only needs to be set for the quanta.wiki or quantizr.com builds.
export PROD_DEPLOYER_BASE=/home/clay/ferguson/scripts/linode