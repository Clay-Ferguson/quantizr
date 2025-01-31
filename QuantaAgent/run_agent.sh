#!/bin/bash

if [[ "$CONDA_DEFAULT_ENV" == "quanta_agent" ]]; then
  python3 Quanta_Agent.py
else
  echo "Wrong Conda Environment: Expected quanta_agent but found $CONDA_DEFAULT_ENV"
  sleep 10s
  exit 1
fi
