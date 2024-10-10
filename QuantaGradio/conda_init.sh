#!/bin/bash

conda_path="/home/clay/miniconda3"
export PATH="$conda_path/bin:$PATH"

if ! conda env list | grep -q "quanta_gradio"; then
  echo "Creating Conda Environment: quanta_gradio"
  conda create -n quanta_gradio python=3.12.3
  ./install_modules.sh
fi

source $conda_path/bin/activate quanta_gradio