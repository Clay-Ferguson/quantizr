#!/bin/bash
# referenced by dockerfiles.

java -Xms${XMS} -Xmx${XMX} \
    -Dloader.path=/loader-path \
    -Djava.security.egd=file:/dev/./urandom \
    -jar app.jar
