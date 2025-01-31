"""Runs a basic ChatBot with Tool Use using Gradio interface.
You can use this as the simplest possible test to verify that Gradio (with Tools) is working.

In the gui the following prompt will run a tool test: 
prompt = "run the test tool using input string "abc"
"""

import sys
import os
from typing import Type
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool
from langchain.chat_models.base import BaseChatModel
import gradio as gr
from gradio import ChatMessage
from langchain.prompts import ChatPromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder
from langchain.schema import HumanMessage, SystemMessage, AIMessage
from langchain.agents import AgentExecutor, create_openai_tools_agent

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
    AppConfig.init_config()
    Utils.init_logging(f"{AppConfig.cfg.data_folder}/Quanta_Gradio_AgentTest.log")
    
    llm: BaseChatModel = AIUtils.create_llm(0.0, AppConfig.cfg)
    
    tools = [DummyTestTool("My Dummy Test Tool")]
    
    chat_prompt_template = ChatPromptTemplate.from_messages([
        SystemMessage(content="You are a helpful assistant with access to the following tools:"),
        MessagesPlaceholder(variable_name="chat_history"),
        HumanMessagePromptTemplate.from_template("Human: {input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])

    async def query_ai(prompt, messages):
        # Convert messages to a format the agent can understand
        chat_history = []
        for msg in messages:
            if msg['role'] == "user":
                chat_history.append(HumanMessage(content=msg['content']))
            elif msg['role'] == "assistant":
                chat_history.append(AIMessage(content=msg['content']))
    
        agent = create_openai_tools_agent(llm, tools, chat_prompt_template)
        agent_executor = AgentExecutor(agent=agent, tools=tools).with_config({"run_name": "Agent"})
        
        messages.append(ChatMessage(role="user", content=prompt))
        yield messages
        async for chunk in agent_executor.astream(
            {"input": prompt, "chat_history": chat_history}
        ):
            if "steps" in chunk:
                for step in chunk["steps"]:
                    messages.append(ChatMessage(role="assistant", content=step.action.log,
                                    metadata={"title": f"🛠️ Used tool {step.action.tool}"}))
                    yield messages
            if "output" in chunk:
                messages.append(ChatMessage(role="assistant", content=chunk["output"]))
                yield messages

    with gr.Blocks() as demo:
        gr.Markdown("# Chat with a LangChain Agent 🦜⛓️ and see its thoughts 💭")
        chatbot = gr.Chatbot(
            type="messages",
            label="Agent",
            avatar_images=(None, "assets/logo-100px-tr.jpg"),
        )
        input = gr.Textbox(lines=1, label="Chat Message")
        input.submit(query_ai, [input, chatbot], [chatbot])

    demo.launch()         
              