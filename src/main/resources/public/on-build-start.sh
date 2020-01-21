#!/bin/bash
#NOTE: Webpack is what calls this script to compile SASS to CSS. See the webpack.config.js file.
echo "Running on-build-start.sh"

# We don't bundle our (using sass-loader, and webpack) because for performance in PROD we want browsers to 
# be able to simultaneously download the JS bundle file and the CSS file(s). 
node-sass ./css/meta64.scss ./css/meta64.css

if [ $? -eq 0 ]
then
  echo "SASS -> CSS generating successful."
else
  echo "SASS compiler failed."
  exit 1
fi