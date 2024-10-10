"""Runs the Agent"""

import sys
import os

import gradio as gr
# from langchain.chat_models import ChatOpenAI
from langchain.schema import AIMessage, HumanMessage
# import openai

ABS_FILE = os.path.abspath(__file__)
PRJ_DIR = os.path.dirname(os.path.dirname(ABS_FILE))
sys.path.append(PRJ_DIR)

from app_config import AppConfig
from common.python.agent.ai_utils import AIUtils

if __name__ == "__main__":
    print("Quanta Gradio Starting...")
    AppConfig.init_config()
    llm = AIUtils.create_llm(AppConfig.cfg.ai_service, 0.0, AppConfig.cfg)

    def predict(message, history):
        history_langchain_format = []
        for msg in history:
            if msg['role'] == "user":
                history_langchain_format.append(HumanMessage(content=msg['content']))
            elif msg['role'] == "assistant":
                history_langchain_format.append(AIMessage(content=msg['content']))
        history_langchain_format.append(HumanMessage(content=message))
        gpt_response = llm(history_langchain_format)
        return gpt_response.content

    gr.ChatInterface(predict, type="messages").launch()            
    print("Quanta Gradio exiting")
    