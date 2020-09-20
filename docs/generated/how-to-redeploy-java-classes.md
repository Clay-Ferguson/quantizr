## Rapid Redeploy of Java Classes

(An alternative to JRebel)

The `dev` maven profile (see build-dev.sh) also is configured to deploy to docker in a way where the classpath is overridden to load classes directly from the `${PRJROOT}/target/classes` at runtime. This means even when you do a docker compose and redeploy the docker instance, the folder on your machine where the class files are compiled into by your IDE (`/target/classes`) will be where classes are loaded from.

This means if you have changed only Java files and you want to just restart the app using the new Java classes, you can do this using just a docker restart.

In my experience even though there are tools like JRebel, and others that can 'reconfigure/reload' classes without restarting the server there are a lot of complexities that creep into your build pipeline once you start doing that, and they can sometimes not be worth the trouble unless your app is truly gargantuan in size, where a 'docker reload' would take a very lone time. This is not the case with quanzitr, so the technque below can make the process both fast enought *and* importantly, dead simple.

### The docker-compose-dev.yaml 

Has this line in it, as a `volume` entry:

    '${PRJROOT}/target/classes:/loader-path'

This makes the `loader-path` get mapped to the classes your compiler writes to, on your local development machine.

## The dockerfile entrypoint command 

Looks like this:

    ENTRYPOINT ["java", "-Dloader.path=/loader-path", "-Djava.security.egd=file:/dev/./urandom", "-jar", "/subnode/subnode.jar"]

This tells java to use the `loader.path` to make the compiler override any classes in jars in the build code with the ones directly from your target folder.

NOTE: the subnode.jar is the name of the Quanta spring-boot fat jar (for historical/legacy reasons only)

## The 'dev' profile of maven has this plugin in it:

```xml
    <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
        <configuration>
            <layout>ZIP</layout>
        </configuration>
    </plugin>
```

The reason we need to use the ZIP layout has to do with making the 'Dloader.path' option on the VM be able to work, and it also triggers.

Here's the place where I discovered how to do this ZIP layout (sorry, his domain name is so moronic):

    http://www.codevomit.xyz/bootlog/blog/how-to-provide-spring-boot-fat-jar

## Compile-only Profile

To make things as fast as possible we also have a profile named 'java-compile' which has nothing in it but the Java dependencies, so that we can run a 'compiler:compile' maven goal and get a build/compile just of the java Class files, in around 4 seconds!

## Using it: Redeploying

Once you've ran build-dev.sh, and have the docker instance up and running, let's say you then make some changes to any Java files at all. You can then restart the app using the updated Java source, simply by running `restart-dev.sh`. What that will do is run a build to update class files, in the /target/classes folder than then do a `docker restart` command, to restart.

Since the Quanta app can restart in around 2 seconds the only overhead is the time to actually built the new class files, and even something like JRebel can't avoid having to at least *compile* the classes, so this is a great solution for avoiding the expencs, and time, and complexities of JRebel.

On my Core i7 laptop the full build takes around 1 minute, but using the above technique, I can edit some Java Source files and then use 'restart-dev.sh' to get them deployed and 'live' in 4 seconds! Actually I think, in my case this is even much ASTER than JRebel can accomplish.

