#!/bin/bash
source ./setenv.sh
source ./define-functions.sh
cd $PRJROOT

echo Stopping IPFS+SubNode+MongoDB
docker rm -f ipfs_host subnode_dev subnode_mongo_dev -f || true

read -p "done."



