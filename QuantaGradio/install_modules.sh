#!/bin/bash

# TO Reinstall the Conda Environment from scratch run these commands...
#    conda deactivate
#    conda remove --name quanta_gradio --all
#    conda create --name quanta_gradio python=3.12.3
#    conda activate quanta_gradio
#    ./install_modules.sh

source ./conda_init.sh

conda_path="/home/clay/miniconda3"
export PATH="$conda_path/bin:$PATH"
source $conda_path/bin/activate quanta_gradio

if [[ "$CONDA_DEFAULT_ENV" == "quanta_gradio" ]]; then
  read -p "Press ENTER. To install modules."
  # WARNING ************************************************************************************************************************
  # WARNING For some reason running the combined pip installs below always failed unril I also ran the 'langchain' one all by itself.
  #         UPDATE: ditto for 'langgraph'
  # WARNING ************************************************************************************************************************
  pip install \
      gradio \
      langchain \
      langchain-anthropic \
      langchain-google-genai \
      langchain-openai \
      langchain-xai \
      langchain-community \
      langchain-core \
      langchain-text-splitters \
      langgraph \
      pydantic \
      pydantic-core 
else
  echo "Failed to set Conda Environment: Expected quanta_gradio but found $CONDA_DEFAULT_ENV"
  sleep 10s
  exit 1
fi
    
# pip freeze > requirements.txt
# read -p "All Modules Installed"
