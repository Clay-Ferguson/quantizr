#!/bin/bash
source ./setenv.sh
source ./define-functions.sh
#################################################################
#
# NOTE: Normally we don't run this script directly, but it's run indirectly
#       because 'build.sh' calls it indirectly.
#
# credit to: https://mrh.io/ipfs_docker/
#
#################################################################

cd $PRJROOT

echo "Starting IPFS"

# Ensure out staging folder exists.
mkdir -p ${ipfs_staging}

# An earlier version of IPFS used to consuming lots of bandwith, and this 'trickle'
# command was one attempt to fix that, which did not work, HOWEVER, as of December 2019 at least based on my testing
# it appears the the IPFS devs HAVE fixed that bug and IPFS runs without using bandwith when sitting idle.
# trickle -w 10 -t .1 -u 10 -d 20 \
docker run -d \
    --init \
    --restart unless-stopped \
    --name ipfs_host_dev \
    -v ${ipfs_staging}:/export \
    -v ${ipfs_data}:/data/ipfs \
    -w /export \
    -p 4001:4001 \
    -p 127.0.0.1:8080:8080 \
    -p 127.0.0.1:5001:5001 \
    --network="host" \
    ipfs/go-ipfs:latest \
    --routing=dhtclient 

#todo-0: I need to investigate if ipfs/go-ipfs:latest is really stable always, and not some nightly build. I can't remember
#if I ever scrutinized that to be sure I'm using an image that's always production-ready.

verifySuccess "Docker Run (IPFS)"

if docker ps | grep ipfs_host_dev; then
    echo "IPFS started successfully."
else 
    echo "IPFS FAILED to restart."
fi


