#!/bin/sh

set -e

NODE_ENV=production declared-server --port=3000 --name="Simonyi" --playerLimit=256 --npcCount=48 --scoreLimit=20000
