#!/bin/bash
# referenced by dockerfiles.

# NOTE: Trickle values are in KBytes/s
# We use Trickle becasue IPFS is always a resource hog, and this is widely accepted as the only
# way to remedy the issue. IPFS developers are aware and either unwilling or unable to fix this
# this resource issue after being aware of it for several years.
# trickle -u 10 -d 20 
daemon --migrate=true --enable-pubsub-experiment --enable-namesys-pubsub
