"""Runs a basic ChatBot using Gradio interface.
You can use this as the simplest possible test to verify that Gradio is working (without agents or tools). Not using StateGraph (SG)

"""

import sys
import os
import gradio as gr
from langchain.schema import AIMessage, HumanMessage

ABS_FILE = os.path.abspath(__file__)
PRJ_DIR = os.path.dirname(os.path.dirname(ABS_FILE))
sys.path.append(PRJ_DIR)

from app_config import AppConfig
from common.python.agent.ai_utils import AIUtils
from common.python.utils import Utils

if __name__ == "__main__":
    print("Quanta Gradio Chat Test Starting...")
    Utils.check_conda_env("quanta_gradio")
    AppConfig.init_config()
    Utils.init_logging(f"{AppConfig.cfg.data_folder}/Quanta_Gradio_ChatTest.log")
    
    llm = AIUtils.create_llm(0.7, AppConfig.cfg)

    def predict(message, history):
        chat_history = AIUtils.gradio_messages_to_langchain(history)       
        chat_history.append(HumanMessage(content=message))
        gpt_response = llm.invoke(chat_history)
        return gpt_response.content

    gr.ChatInterface(predict, type="messages").launch()            
    