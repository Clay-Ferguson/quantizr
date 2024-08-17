#!/bin/bash

# TO Reinstall the Conda Environment from scratch run these commands before first...
#    conda deactivate
#    conda remove --name quanta_agent --all
#    conda create --name quanta_agent python=3.12.3
#    conda activate quanta_agent

pip install \
    langchain \
    langchain_openai \
    langchain_anthropic \
    langchain-google-genai \
    streamlit_chat \
    configargparse \
    langgraph
    
# pip freeze > requirements.txt
# read -p "All Modules Installed"