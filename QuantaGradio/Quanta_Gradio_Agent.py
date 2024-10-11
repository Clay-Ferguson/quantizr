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
from common.python.utils import RefactorMode, Utils
from common.python.agent.refactoring_tools import (
   DummyTestTool
)

if __name__ == "__main__":
    print("Quanta Gradio Starting...")
    AppConfig.init_config()
    
    # todo-0: We have a problem here that this returns something other than BaseLanguageModel
    # llm = AIUtils.create_llm(AppConfig.cfg.ai_service, 0.0, AppConfig.cfg)
    llm = ChatOpenAI(
                    model=AppConfig.cfg.openai_model, # type: ignore
                    temperature=1.0,
                    api_key=AppConfig.cfg.openai_api_key,
                    timeout=120
                ) 
    
    tools = [DummyTestTool("My Dummy Test Tool")]
    
    promptTemplate = "You are a helpful assistant. Answer the following question: {input}"
    
    chat_prompt_template = ChatPromptTemplate.from_messages([
        SystemMessage(content="You are a helpful assistant with access to the following tools:"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
        HumanMessagePromptTemplate.from_template("Human: {input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])
    
    agent = create_openai_tools_agent(llm, tools, chat_prompt_template)
    agent_executor = AgentExecutor(agent=agent, tools=tools).with_config(
        {"run_name": "Agent"}
    )

    async def queryAI(prompt, messages):
        # print("CodingAgent mode")
        # if AppConfig.cfg.scan_extensions is not None:
        #     # Convert the comma delimted string of extensions (without leading dots) to a set of extensions with dots
        #     ext_set: Set[str] = {f".{ext.strip()}" for ext in AppConfig.cfg.scan_extensions.split(',')}

        # folders_to_include = []
        # if AppConfig.cfg.folders_to_include is not None:
        #     folders_to_include = AppConfig.cfg.folders_to_include.split("\n")

        # # todo-0: Implement foldersToExclude
        # folders_to_exclude = []

        # agent = QuantaAgent()
        # agent.run(
        #     "", # req.systemPrompt if req.systemPrompt else "",
        #     "anth", # req.service,
        #     RefactorMode.REFACTOR.value,
        #     "",
        #     messages,
        #     "What is the capital of France", # req.prompt if req.prompt else "",
        #     False,
        #     # Note: These folders are defined by the docker compose yaml file as volumes.
        #     "/projects",
        #     folders_to_include,
        #     folders_to_exclude,
        #     "/data",
        #     ext_set,
        #     llm,
        #     ""
        # )
        
        # begin Gradio
        messages.append(ChatMessage(role="user", content=prompt))
        yield messages
        async for chunk in agent_executor.astream(
            {"input": prompt}
        ):
            if "steps" in chunk:
                for step in chunk["steps"]:
                    messages.append(ChatMessage(role="assistant", content=step.action.log,
                                    metadata={"title": f"🛠️ Used tool {step.action.tool}"}))
                    yield messages
            if "output" in chunk:
                messages.append(ChatMessage(role="assistant", content=chunk["output"]))
                yield messages
        # end gradio
        # answer = messages[-1].content # type: ignore

    with gr.Blocks() as demo:
        gr.Markdown("# Chat with a LangChain Agent 🦜⛓️ and see its thoughts 💭")
        chatbot = gr.Chatbot(
            type="messages",
            label="Agent",
            avatar_images=(
                None,
                "https://em-content.zobj.net/source/twitter/141/parrot_1f99c.png",
            ),
        )
        input = gr.Textbox(lines=1, label="Chat Message")
        input.submit(queryAI, [input, chatbot], [chatbot])

    demo.launch()         
              
    print("Quanta Gradio exiting")
    