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
from gradio import ChatMessage
from langchain.prompts import ChatPromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder
from langchain.schema import AIMessage, HumanMessage, SystemMessage
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_tools_agent, load_tools
from langchain.tools import Tool

ABS_FILE = os.path.abspath(__file__)
PRJ_DIR = os.path.dirname(os.path.dirname(ABS_FILE))
sys.path.append(PRJ_DIR)

from app_config import AppConfig
from common.python.agent.ai_utils import AIUtils
from common.python.agent.app_agent import QuantaAgent
from langchain.chat_models.base import BaseChatModel
from common.python.utils import RefactorMode, Utils

if __name__ == "__main__":
    print("Quanta Gradio Starting...")
    AppConfig.init_config()

    async def query_ai(prompt, messages):
        llm: BaseChatModel = AIUtils.create_llm(1.0, AppConfig.cfg)
        
        # todo-0: make these NEVER have a period on front of the input string from the config file. To be consistent with java code.
        if AppConfig.cfg.scan_extensions is not None:
            # Convert the comma delimted string of extensions (without leading dots) to a set of extensions with dots
            ext_set: Set[str] = {f"{ext.strip()}" for ext in AppConfig.cfg.scan_extensions.split(',')}

        folders_to_include = []
        if AppConfig.cfg.folders_to_include is not None:
            folders_to_include = AppConfig.cfg.folders_to_include.split("\n")
            # remove empty strings
            folders_to_include = list(filter(None, folders_to_include))

        # todo-0: Implement foldersToExclude
        folders_to_exclude = []

        agent = QuantaAgent()
        async for result in agent.run_gradio(
            "", # extra user system prompt
            AppConfig.cfg.ai_service,
            RefactorMode.REFACTOR.value,
            "", # output_file_name
            messages,
            prompt,
            False, # parse_prompt
            # Note: These folders are defined by the docker compose yaml file as volumes.
            AppConfig.cfg.source_folder,
            folders_to_include,
            folders_to_exclude,
            AppConfig.cfg.data_folder,
            ext_set,
            llm,
            ""
        ):
            # Handle each yielded result
            if isinstance(result, list):
                messages = result
        yield messages

    with gr.Blocks() as demo:
        gr.Markdown("# Quanta Coding Agent")
        chatbot = gr.Chatbot(
            type="messages",
            label="Agent",
            avatar_images=(
                # todo-0: put our own bot avatars in from local files.
                None,
                "https://em-content.zobj.net/source/twitter/141/parrot_1f99c.png",
            ),
        )
        input = gr.Textbox(lines=1, label="Chat Message")
        input.submit(query_ai, [input, chatbot], [chatbot])

    demo.launch()         
    print("Quanta Gradio exiting")
    