#!/bin/bash

# Since we use the VSCode integrated terminal to run scripts we have to make each of those
# scripts run this shell script first to ensure that 'scripts' folder is our current working
# folder becasue the VSCode terminal is incapable of this due to a bug in VSCode.
#
cd /home/clay/ferguson/Quantizr/scripts