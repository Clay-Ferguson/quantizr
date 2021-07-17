#!/bin/bash

#Ref: https://github.com/sass/node-sass
#NOTE: Webpack is what calls this script to compile SASS to CSS. See the webpack.config.js file.
echo "Running on-build-start.sh"

# We don't bundle our (using sass-loader + webpack) because for performance in PROD we want browsers to 
# be able to simultaneously download the JS bundle file and the CSS file(s). 
# NOTE: our css output here does include all of bootstrap, because we include bootstrap source into our SASS compile.

# NOTE: If something goes wrong here check that the internal version of npm/node specified
# in the pom-main.xml is the same as the version installed on the system.

# Here's how to install node-sass on Ubuntu:
#     sudo apt update
#     sudo apt install nodejs npm
#     sudo npm install --save-dev --unsafe-perm -g node-sass
node-sass ./css/meta64.scss ./css/meta64.css --output-style compressed

if [ $? -eq 0 ]
then
    echo "SASS -> CSS generating successful."
else
    echo "SASS compiler failed. Tip: See notes in the on-build-start.sh"
    exit 1
fi