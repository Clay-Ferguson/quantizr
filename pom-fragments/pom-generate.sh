#!/bin/bash
# todo-0: fix paths

# =============================================================================
# POM.XML GENERATOR
# =============================================================================
# Generates pom.xml by substituting files into pom-main.xml using 'sed'.
#
# This script allows us to embed lines like "<!--include:common-->" into a pom.xml file and create an
# includes feature to POM.XML without having to jump thru hoops like using POM inheritance or module aggregation 
# just to solve the include problem.
#
# References:
# https://stackoverflow.com/questions/16811173/bash-inserting-one-files-content-into-another-file-after-the-pattern/20656725

cp ./pom-main.xml ${PRJROOT}/pom.xml
sed -i -e "/<!--include:common-->/rcommon.xml" ${PRJROOT}/pom.xml
sed -i -e "/<!--include:spring-boot-->/rorg.springframework.boot.xml" ${PRJROOT}/pom.xml

echo "pom-generate done!"


