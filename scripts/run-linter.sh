#!/bin/bash

# NOTE: I'd love to get this move into webpack (done by webpack), but there's a million different
# pages online about how to do this and every one of them uses a completely different technique
# so for now I'm just leaving this as is, since it works fine.

cd ${PRJROOT}/src/main/resources/public
./node_modules/.bin/eslint . --ext .ts 

# add this param to the end to auto-fix
# --fix

verifySuccess "Linter"
