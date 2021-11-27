#!/bin/bash

# WebUi: http://localhost:5001/webui

# Reference
# https://docs.ipfs.io/reference/cli/#ipfs-add

# The docker-compose-dev.yaml maps a volume named ipfs_test_root to a local folder so we can put
# files in there and then run this script to have the ipfs-def docker instance

CMD="docker exec -it ipfs-dev"
# -r=recursive -w=wrap in directory
# $CMD ipfs add -r -w ipfs_test_root/test-file.txt

# $CMD ipfs files stat /
$CMD ipfs files ls /

read -p "done. Press enter"
