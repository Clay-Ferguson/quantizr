#!/bin/bash

# Shows an example of how to publish arbitrary JSON (in this case a name and website) to IPNS. This IPNS name
# will then be permanent (as long as you keep using the same KeyName) and can be shared across the web 
# like a permalink, but you'll be able to update this permalink at any time. Note that if you already
# know the CID of something you want to publish, then you can omit all the parts of this script above the line
# that sets teh CID variable and just set it directly.

# Ensure IPFS is running with this if you need to...
# ipfs daemon &

# Set the name for the Key file (any name of your choice)
KeyName=my-secret-publishing-key

# Create an identity file (to publish to IPNS)
# We just need to get a CID to publish below, but you can use any CID you want containing any content you want
cat >./identity.json <<EOL
{
    "name": "clay@quanta.wiki",
    "website": "https://quanta.wiki/u/clay/contact"
}
EOL

# Add identity file to IPFS and save output of command to txt file
ADD_OUTPUT=$(ipfs add identity.json | tee ./ipfs-add-output.txt)
array=($ADD_OUTPUT)
CID=${array[1]}

# Only need to do this once 
ipfs key gen ${KeyName}
# ipfs key list

echo "Processing Publish (can take several minutes)"
ipfs name publish --key=${KeyName} ${CID} | tee ./ipns-publish-output.txt

# NOTE: The "Name" we just generated with "ipfs name publish" (shown in the output) will be a valid IPNS name we can
# uses in Brave browser url as: `ipns://${Name}`.

# Also accessible from Gateways as:
# # Public Gateway
# links: https://ipfs.io/ipns/${Name}

read -p "Done. Press any key."
