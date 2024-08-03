#!/bin/bash

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