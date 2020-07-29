#!/bin/bash

DOMAIN=swarmpit.decla.red
NODE_ID=$(docker info -f '{{.Swarm.NodeID}}')
docker node update --label-add swarmpit.db-data=true $NODE_ID
docker node update --label-add swarmpit.influx-data=true $NODE_ID
docker stack deploy -c docker-compose.swarmpit.yml swarmpit
