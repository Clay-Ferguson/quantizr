# Node Organization

The following describes the structural layout of the Quanta 'tree'. Remember, every node has a unique ID, a path, and a type (among other properties)

NOTE: this document is not complete and currently only represents a small number of nodes.

## Public Landing Page 

    Path=/r/public/home

It's up to the admin user to ensure this home node contains whatever they want users to see after clicking thru the main landing page to get into the actual app.

## User Guide 

    Path=/r/public/userguide

Admin user is expected to import the user guide onto this node as part of the configuration of the server.

## Root of all User Nodes 

    Path=/r/usr

All user accounts are created under this path and named like this:

    Path=/r/usr/[userId]

where [id] is the actual node id also of the user node itself. User Node is synonymous with "Account Node" and is the node under which any user has his entire set of subnodes.

## User's Outbox (or Posts) node

    Path=/r/usr/[userId]
    Type=sn:userFeed

User's outbox is found by looking for a node of type 'sn:userFeed' that is a direct child of their account node.
