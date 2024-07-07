#!/bin/bash
mongosh -u root -p password --port 27017 --host mongo-host-distro --quiet <<EOF
  rs.initiate(
    {
      _id: "rs0",
      members: [
        { _id: 0, host: "mongo-host-distro:27017" }
      ]
    }
  );
EOF
