#!/bin/bash

REMOTE_ADDRESS=$1
echo Initializing new machine, $REMOTE_ADDRESS

cat init-remote.sh | ssh $REMOTE_ADDRESS
