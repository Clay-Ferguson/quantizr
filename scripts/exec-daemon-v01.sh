#!/bin/bash


# TL;DR: This is a daemon to watch a folder and execute any scripts that appear in that folder, and execute them
# as soon as possible, and execute them only once. 
#
# NOTE: This script is the Host-side support for what is going on in the BashService.java class, which is a way of 
# lanuching arbitrary bash commands on the host machine! This is extremely dangerous power to give to end users
# because it gives full control over the host, and is only enabled for he 'admin' account of SubNode.
#
# The way this works is the BashService writes a script into the tmp folder, and then this deamon simply notices it
# and immediately runs it.
#
# Note: it would be very undesirable if two of these scripts ever ran on the same subfolder so we use a 
# file designated as $lockfile (below) to reliably detect and avoid running two instances of this script ever.
#
# BE CAREFUL: This script is a daemon which immediately RUNS any script that it notices having changed. This
# will eventually be used to allow the BashService of SubNode web app to be able execute (albeit indirectly thru this daemon)
# arbitrary shell commands on the host. 
#
# Example Bash NodeType content:
#     gnome-terminal -- /bin/bash -c 'ls /home/clay/ferguson; read'
#     -- or --
#     code /home/clay/ferguson
#

watchfolder=/home/clay/ferguson/subnode-tmp
lockfile=$watchfolder/deamon.lock
if [ -f "$lockfile" ]
then
    echo "Deamon already running, because lockfile exists: $lockfile."
    echo "Terminal will close in 3 secs."
    sleep 3
    exit 0
fi

#create the the lock file whose purpose is to simply indicate reliably that this demon is running.
touch $lockfile

set -e
function onExit {
   rm $lockfile
   #echo "Lock file removed. Trap ran"
   #sleep 3
}
trap onExit EXIT

myrun() {
    echo running $1
    $1

    # I added this line (to delete script after running, but haven't tested it yet. We definitely want to delete after running
    # so that it's impossible to run any script twice, by design)
    rm $1
}

# We have to export the myrun function since it's being executed using "-exec bash -c" below
export -f myrun

# Function Args
# ARG 1=Folder to watch
# ARG 2=Time per loop, in minutes (can be a decimal, representing less than one minute)
daemon() {

    echo watching folder $1 every $2 min.

    while [[ true ]]
    do
        # Find all the recently saved sh files that have their execute bit also set. The 'nice' command is a way
        # to execute without causing any noticeable CPU degredation (lowers priority of thread)
        nice find $1/  -name \*.sh -perm /u+x -type f -mmin $2 -exec bash -c 'myrun "$0"' {} \;
        sleep $2m
    done
}

daemon $watchfolder .03

read -p "All Done!  Press any key"
