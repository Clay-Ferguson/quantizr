#!/bin/bash

# =============================================================================
# POM.XML GENERATOR
# =============================================================================
# Generates pom.xml from pom-main.xml (using ./pom-fragements/*).
#
# This script allows us to embed lines like "<!--include:commons.xml-->" into a pom.xml file and create an
# includes feature to POM.XML without having to jump thru hoops like using POM inheritance or module aggregation 
# just to solve the include problem.
#
# The way that example would work is that 'commons.xml' is expected to be in a folder named './pom-fragements' and 
# the entire content of the fragment files get inserted into the xml inline, just below the 'include' operator.
#
# If you don't want to use this you can just keep pom.xml, and 
# delete pom-main.xml, and this script file and all will continue to work just fine. 
# However as the developer of quantizr I like to use this generator because, as you can see if you look at
# pom-main.xml (my way of editing the pom) that file is very simple and easy to read.
#
# References:
# https://stackoverflow.com/questions/16811173/bash-inserting-one-files-content-into-another-file-after-the-pattern/20656725

cp ./pom-main.xml ./pom.xml
FILES=./pom-fragments/*
for f in $FILES
do
     echo "pom-fragment: $f"
     NAME=$(basename $f)
     sed -i -e "/<!--include:$NAME-->/r$f" ./pom.xml 
done

echo "pom-generate done!"


