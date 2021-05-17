#!/bin/bash

# Check that servers can ping each other at p1+p2
docker exec quanta-dev2 /bin/sh -c "ping -c 1 q1"
docker exec quanta-dev1 /bin/sh -c "ping -c 1 q2"

echo
echo "***********************************"
echo "CURL Actor bob@q2 from q1"
echo "***********************************"
docker exec quanta-dev1 /bin/sh -c "curl -i -H 'Accept: application/activity+json' 'http://q2:8183/ap/u/bob'"
echo
echo

echo
echo "***********************************"
echo "CURL Actor bob@q1 from q2"
echo "***********************************"
docker exec quanta-dev2 /bin/sh -c "curl -i -H 'Accept: application/activity+json' 'http://q1:8182/ap/u/bob'"
echo
echo

echo
echo "***********************************"
echo "CURL Actor adam@q2 from q1"
echo "***********************************"
docker exec quanta-dev1 /bin/sh -c "curl -i -H 'Accept: application/activity+json' 'http://q2:8183/ap/u/adam'"
echo
echo

echo
echo "***********************************"
echo "CURL Actor adam@q1 from q2"
echo "***********************************"
docker exec quanta-dev2 /bin/sh -c "curl -i -H 'Accept: application/activity+json' 'http://q1:8182/ap/u/adam'"
echo
echo
