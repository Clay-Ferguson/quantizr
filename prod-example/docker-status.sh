#!/bin/bash

SERVICE=quanta-stack-distro_quanta-distro
NETWORK=bridge

echo "_________________________________________________________"
echo "Running Containers "
echo ""
docker ps
echo ""

echo "_________________________________________________________"
echo "Networks"
echo ""
docker network ls
echo ""

echo "_________________________________________________________"
echo "Network Inspect ${NETWORK}"
echo ""
docker network inspect ${NETWORK}
echo ""

echo "_________________________________________________________"
echo "Stacks"
echo ""
docker stack ls
echo ""

echo "_________________________________________________________"
echo "Services"
echo ""
docker service ls
echo ""

echo "_________________________________________________________"
echo "Inspect Service ${SERVICE}"
echo ""
docker service inspect ${SERVICE}
echo ""

echo "_________________________________________________________"
echo "Service Containers ${SERVICE}"
echo ""
docker service ps --no-trunc ${SERVICE}
echo ""

echo "_________________________________________________________"
echo "Service Logs ${SERVICE}"
echo ""
docker service logs ${SERVICE}
echo ""

echo "_________________________________________________________"
echo "Images"
echo ""
docker image ls
echo ""

read -p "Press ENTER"