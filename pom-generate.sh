#!/bin/bash

# Generates pom.xml from pom-main.xml (using ./pom-fragements/*). If you don't want to use this you can just keep pom.xml, and 
# delete pom-main.xml, and this script file and all will continue to work just fine. 
# However as the developer of quantizr I like to use this generator because, as you can see if you look at
# pom-main.xml (my way of editing the pom) that file is very simple and easy to read.

cp ./pom-main.xml ./pom.xml
FILES=./pom-fragments/*
for f in $FILES
do
     echo "Processing $f file..."
     NAME=$(basename $f)
     sed -e "/<!--$NAME-->/r$f" ./pom.xml > ./pom-tmp.xml
     cp ./pom-tmp.xml ./pom.xml
done

rm ./pom-tmp.xml
echo "pom-generate done!"


