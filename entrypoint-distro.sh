#!/bin/bash
# referenced by dockerfiles.

java -Xms${XMS} -Xmx${XMX} \
    -Djava.security.egd=file:/dev/./urandom \
    -jar app.jar
