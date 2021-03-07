#!/bin/bash

# =============================================================================
# POM.XML GENERATOR
# =============================================================================
# Generates pom.xml by substituting files into pom-main.xml using 'sed'. I think ordinary includes (text substitution)
# would be a nice feature to have in arbitrary XML files, so I invented one here. I'm just using 'sed' utility.
#
# This script allows us to embed lines like "<!--include:common-->" into a pom.xml file and create an
# includes feature to POM.XML without having to jump thru hoops like using POM inheritance or POM module aggregation 
# just to solve the include problem.
# 
# NOTE: Do not call this directly. It's called by the build scripts, where bash variables have already been defined.
#
# References:
# https://stackoverflow.com/questions/16811173/bash-inserting-one-files-content-into-another-file-after-the-pattern/20656725

# take pom-main.xml and initialize a 'pom.xml' with it.
cp ./pom-main.xml ${PRJROOT}/pom.xml

# Replace every instance of the text '<!--include:common-->' with the content of 'common.xml' file.
sed -i -e "/<!--include:common-->/rcommon.xml" ${PRJROOT}/pom.xml

# ditto, same kind of substitution again here.
sed -i -e "/<!--include:spring-boot-->/rorg.springframework.boot.xml" ${PRJROOT}/pom.xml

echo "pom-generate done!"


