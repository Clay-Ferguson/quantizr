#!/bin/bash

# TO Reinstall the Conda Environment from scratch run these commands before first...
#    conda deactivate
#    conda remove --name quanta_agent --all
#    conda create --name quanta_agent python=3.12.3
#    conda activate quanta_agent

source ./conda_init.sh

conda_path="/home/clay/miniconda3"
export PATH="$conda_path/bin:$PATH"
source $conda_path/bin/activate quanta_agent

if [[ "$CONDA_DEFAULT_ENV" == "quanta_agent" ]]; then
  read -p "Press ENTER. To install modules."
  pip install \
    langchain \
    langchain_openai \
    langchain_anthropic \
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
