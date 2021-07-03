# WE include all of JRE which is huge but in the future we can do something like this:
# https://stackoverflow.com/questions/53669151/java-11-application-as-lightweight-docker-image

FROM openjdk:11-jre
LABEL maintainer="wclayf@gmail.com"

# Note: Args cannot be set during final runtime!
ARG PORT
ARG PORT_DEBUG
ARG JAR_FILE
ARG XMS
ARG XMX

RUN mkdir -p /dev-resource-base
RUN echo "dummy" > /dev-resource-base/dummy.txt

RUN mkdir -p /loader-path
RUN echo "dummy" > /loader-path/dummy.txt

WORKDIR /quanta

EXPOSE ${PORT}
EXPOSE ${PORT_DEBUG}
EXPOSE 4001

COPY ${JAR_FILE} /quanta/app.jar
RUN sh -c 'touch /quanta/app.jar' 

COPY ./entrypoint.sh /quanta/entrypoint.sh
RUN ["chmod", "+x", "/quanta/entrypoint.sh"]
ENTRYPOINT ["/bin/bash", "-c", "/quanta/entrypoint.sh"]

# This works too but it's more flexible to just put the commands in 'entrypoint.sh'
# ENTRYPOINT ["/bin/bash", "-c", "java -Xms${XMS} -Xmx${XMX} -Dloader.path=/loader-path -Djava.security.egd=file:/dev/./urandom -jar /quanta/app.jar"]
