#!/bin/bash

# TO Reinstall the Conda Environment from scratch run these commands before first...
#    conda deactivate
#    (note: repeat 'conda deactivate' until no more environments are showing active)
#    conda remove --name quanta_agent --all
#    conda create --name quanta_agent python=3.12.3
#    conda activate quanta_agent
#    ./install_modules.sh # this file

if [[ "$CONDA_DEFAULT_ENV" == "quanta_agent" ]]; then
  read -p "Press ENTER. To install modules."
  pip install \
    langchain \
    langchain-openai \
    langchain-xai \
    langchain-anthropic \
    langchain-google-genai \
    configargparse \
    langgraph \
    watchdog \
    gradio
else
  echo "Failed to set Conda Environment: Expected quanta_agent but found $CONDA_DEFAULT_ENV"
  sleep 10s
  exit 1
fi
    
# pip freeze > requirements.txt
# read -p "All Modules Installed"
