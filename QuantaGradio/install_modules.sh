#!/bin/bash

# TO Reinstall the Conda Environment from scratch run these commands...
#    conda deactivate
#    (note: repeat 'conda deactivate' until no more environments are showing active)
#    conda remove --name quanta_gradio --all
#    conda create --name quanta_gradio python=3.12.3
#    conda activate quanta_gradio
#    ./install_modules.sh  # this file

if [[ "$CONDA_DEFAULT_ENV" == "quanta_gradio" ]]; then
  read -p "Press ENTER. To install modules."
  # WARNING ************************************************************************************************************************
  # Note 1: For some reason running the combined pip installs below always failed until I also ran the 'langchain' one all by itself.
  #         UPDATE: ditto for 'langgraph'
  # Note 2: For some reason VSCode can sometimes vail to find modules that are installed even though both the terminal and the VSCode
  #         runtime are properly set and pointing to the correct conda environment. Once this happens the ONLY solution is to completely
  #         blow away the conda environment (using above steps) and reinstall the modules, and also close and reopen VSCode.
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
      pydantic-core \
      configargparse \
      watchdog
else
  echo "Wrong Conda Environment: Expected quanta_gradio but found [$CONDA_DEFAULT_ENV]"
  sleep 10s
  exit 1
fi
    
# pip freeze > requirements.txt
# read -p "All Modules Installed"
