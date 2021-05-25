#!/bin/bash

docker exec mongo-prod /dumps/_backup.sh

read -p "All done."