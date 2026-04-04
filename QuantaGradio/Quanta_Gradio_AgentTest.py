"""Runs a basic ChatBot with Tool Use using Gradio interface.
You can use this as the simplest possible test to verify that Gradio (with Tools) is working.

In the gui, you can ask questions like "What is 3 + 4?" and the agent will use the addition tool to calculate the answer.
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
from langgraph.prebuilt import create_react_agent

ABS_FILE = os.path.abspath(__file__)
PRJ_DIR = os.path.dirname(os.path.dirname(ABS_FILE))
sys.path.append(PRJ_DIR)

from common.python.agent.ai_utils import AIUtils
from common.python.utils import Utils
from app_config import AppConfig

class AdditionToolInput(BaseModel):
    number1: float = Field(description="First number to add")
    number2: float = Field(description="Second number to add")

class AdditionTool(BaseTool):
    """Tool for adding two numbers together"""

    name: str = "addition_tool"
    description: str = "Use this tool when you need to add two numbers together. Input should be two numbers."
    
    args_schema: Type[BaseModel] = AdditionToolInput
    return_direct: bool = True 
    
    def __init__(self, description):
        super().__init__(description=description)
        print(f"Created AdditionTool as {description}")

    def _run(self, number1: float, number2: float) -> str:
        """Add two numbers together."""
        result = number1 + number2
        return f"The sum of {number1} and {number2} is {result}"

if __name__ == "__main__":
    print("Quanta Gradio Agent Test Starting...")
    Utils.check_conda_env("quanta_gradio")
    AppConfig.init_config()
    Utils.init_logging(f"{AppConfig.cfg.data_folder}/Quanta_Gradio_AgentTest.log")
    
    llm: BaseChatModel = AIUtils.create_llm(0.0, AppConfig.cfg)
    tools = [AdditionTool("A tool that adds two numbers together")]

    # Create the ReAct agent
    agent = create_react_agent(
        model=llm,
        tools=tools,
    )

    async def query_ai(prompt, messages):
        chat_history = AIUtils.gradio_messages_to_langchain(messages)
        chat_history.append(HumanMessage(content=prompt))    
        messages.append(ChatMessage(role="user", content=prompt))
        yield messages, ""
        
        async for chunk in agent.astream({"messages": chat_history}):
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
