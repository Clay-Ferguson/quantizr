#!/bin/bash -i

# TIP: If you're running VSCode, and you have issues with the node version inside VSCode terminals not matching
# the one in your system, you can solve this by running the following command *outside* of VSCode:
#
#     nvm alias default <version>
#
# Ths works because VSCode will use the 'default' alias and therefore it will use the version you set. After you run
# the command, restart VSCode, and close/reopen all terminals and you should be good to go.


# WARNING: This script is called FROM ./scripts/build.sh where some environment setup
# and other important precitions MUST be met before running this script

if [ -z "$quanta_domain" ]
then
    read -p "\$quanta_domain is empty. Don't run this batch file directly. It's run from a 'build-*.sh' file"
    exit
fi

if [ ! -d "node_modules" ]; then
    echo "node_modules directory not found, running 'yarn install'..."
    echo "Working Dir=$(pwd)"
    read -p "Press ENTER to continue..."
    yarn install
else
    echo "node_modules found."
fi

yarn run eslint .
verifySuccess "ESLint"
yarnCheck

yarn run ${VITE_SCRIPT}
verifySuccess "yarn run vite: ${VITE_SCRIPT}"
yarnCheck

# Note: quanta.scss specifies this: $fa-font-path: "../fonts/fa"; pointing to this fonts folder.
# The rest of the font awesome config is accomplished simply by including the font-awesome scss 
# folder (in node_modules) into our SCSS main file (quanta.css).
# todo-0: review this re recent changes to bootstrap build with vite
rsync -aAX --delete --force "./node_modules/font-awesome/fonts/" "./fonts/fa/"

