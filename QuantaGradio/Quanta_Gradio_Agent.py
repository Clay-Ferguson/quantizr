"""Runs a basic ChatBot using Gradio interface.
You can use this as the simplest possible test to verify that Gradio is working.

NOTE: This file is now a work in progress and is what will eventually be the GUI app which can 
run the Quanta Coding Agent. For now, all we've done in this file is demonstrate that we can run
a basic ChatBot using Gradio and with a basic test tool.
"""

import sys
import os
from typing import Set
import gradio as gr

ABS_FILE = os.path.abspath(__file__)
PRJ_DIR = os.path.dirname(os.path.dirname(ABS_FILE))
sys.path.append(PRJ_DIR)

from app_config import AppConfig
from common.python.agent.ai_utils import AIUtils
from common.python.agent.app_agent import QuantaAgent
from langchain.chat_models.base import BaseChatModel

if __name__ == "__main__":
    print("Quanta Gradio Agent Starting...")
    AppConfig.init_config()

    async def query_ai(prompt, messages):
        llm: BaseChatModel = AIUtils.create_llm(1.0, AppConfig.cfg)
        
        # # todo-0: make these NEVER have a period on front of the input string from the config file. To be consistent with java code.
        # if AppConfig.cfg.scan_extensions is not None:
        #     # Convert the comma delimted string of extensions (without leading dots) to a set of extensions with dots
        #     ext_set: Set[str] = {f"{ext.strip()}" for ext in AppConfig.cfg.scan_extensions.split(',')}

        agent = QuantaAgent()
        async for result in agent.run_gradio(
            AppConfig.cfg.ai_service,
            "", # output_file_name
            messages,
            prompt,
            AppConfig.cfg.source_folder,
            AppConfig.folders_to_include,
            AppConfig.folders_to_exclude,
            AppConfig.cfg.data_folder,
            AppConfig.ext_set,
            llm
        ):
            # Handle each yielded result
            if isinstance(result, list):
                messages = result
        yield messages

    with gr.Blocks() as demo:
        gr.Markdown("#### Quanta Coding Agent")
        chatbot = gr.Chatbot(
            type="messages",
            label="Agent",
            avatar_images=(None, "assets/logo-100px-tr.jpg")
        )
        # todo-0: we need a separate submit button (not hitting ENTER in text field) and a multiline text field for the input
        input = gr.Textbox(lines=1, label="Chat Message")
        input.submit(query_ai, [input, chatbot], [chatbot])

    demo.launch()         
    