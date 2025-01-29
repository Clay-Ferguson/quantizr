#!/bin/bash

# NOTE: Run this in VSCode Terminal AND don't forget to also open a Python file and notice that you need to check
# that VSCode is indeed activated to the correct conda environment, by visually looking at lower right corner of VSCode.
#
# conda activate quanta_gradio

if [[ "$CONDA_DEFAULT_ENV" == "quanta_gradio" ]]; then
  rm /home/clay/ai-agent-temp/Quanta_Gradio_*.log
  python3 Quanta_Gradio_Agent.py
else
  echo "Wrong Conda Environment: Expected quanta_gradio but found $CONDA_DEFAULT_ENV"
  sleep 10s
  exit 1
fi
