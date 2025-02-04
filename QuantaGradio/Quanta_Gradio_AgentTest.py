"""Runs a basic ChatBot with Tool Use using Gradio interface.
You can use this as the simplest possible test to verify that Gradio (with Tools) is working.

In the gui the following prompt will run a tool test: 
prompt = "run the test tool using input string "abc"

NOTE: This agent is known to work with both Anthropic and OpenAI LLMs!
"""

import sys
import os
from typing import Type
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool
from langchain.chat_models.base import BaseChatModel
import gradio as gr
from gradio import ChatMessage
from langchain.schema import HumanMessage
from langgraph.prebuilt import chat_agent_executor

ABS_FILE = os.path.abspath(__file__)
PRJ_DIR = os.path.dirname(os.path.dirname(ABS_FILE))
sys.path.append(PRJ_DIR)

from common.python.agent.ai_utils import AIUtils
from common.python.utils import Utils
from app_config import AppConfig

class DummyTestToolInput(BaseModel):
    input: str = Field(description="Dummy input for testing")

class DummyTestTool(BaseTool):
    """Dummy tool for testing purposes"""

    name: str = "test_tool"
    description: str = "Used for testing that the tools support is working"
    
    args_schema: Type[BaseModel] = DummyTestToolInput
    return_direct: bool = True 
    
    def __init__(self, description):
        super().__init__(description=description)
        print(f"Created DummyTestTool as {description}")

    def _run(self, input: str) -> str:
        """Use the tool."""
        print(f"DummyTestTool: {input}")
        return "Return val from DummyTestTool2 with input: "+input

if __name__ == "__main__":
    print("Quanta Gradio Agent Test Starting...")
    Utils.check_conda_env("quanta_gradio")
    AppConfig.init_config()
    Utils.init_logging(f"{AppConfig.cfg.data_folder}/Quanta_Gradio_AgentTest.log")
    
    llm: BaseChatModel = AIUtils.create_llm(0.0, AppConfig.cfg)
    tools = [DummyTestTool("My Dummy Test Tool")]

    async def query_ai(prompt, messages):
        chat_history = AIUtils.gradio_messages_to_langchain(messages)
        agent_executor = chat_agent_executor.create_tool_calling_executor(llm, tools)
    
        chat_history.append(HumanMessage(content=prompt))    
        messages.append(ChatMessage(role="user", content=prompt))
        yield messages, ""
        
        async for chunk in agent_executor.astream({"messages": chat_history}):
            AIUtils.handle_agent_response_item(chunk, messages, True)
            yield messages, ""            

    with gr.Blocks() as demo:
        gr.Markdown("# Chat Agent Test")
        chatbot = gr.Chatbot(
            type="messages",
            label="Agent",
            avatar_images=(None, "assets/logo-100px-tr.jpg"),
        )
        input = gr.Textbox(lines=1, label="Chat Message")
        input.submit(query_ai, [input, chatbot], [chatbot, input])

    demo.launch()         
              