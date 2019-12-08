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

echo "Docker Run IPFS"

mkdir -p ${ipfs_staging}

# IPFS, as far as i can tell, it's impossible to stop IPFS from consuming lots of bandwith, and this 'trickle'
# command was an attempt to fix that, which did not work.
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

verifySuccess "Docker Run (IPFS)"

if docker ps | grep ipfs_host_dev; then
    echo "IPFS started successfully."
else 
    echo "IPFS FAILED to restart."
fi


