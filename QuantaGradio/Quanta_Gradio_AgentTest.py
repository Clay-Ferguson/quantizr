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

import gradio as gr
from gradio import ChatMessage
from langchain.prompts import ChatPromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder
from langchain.schema import SystemMessage
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_tools_agent

ABS_FILE = os.path.abspath(__file__)
PRJ_DIR = os.path.dirname(os.path.dirname(ABS_FILE))
sys.path.append(PRJ_DIR)
from app_config import AppConfig

class DummyTestToolInput(BaseModel):
    input: str = Field(description="Dummy input for testing")

class DummyTestTool(BaseTool):
    """Dummy tool for testing purposes"""

    # Warning there is a reference to this block name in "block_update_instructions.txt", although things do work
    # fine even without mentioning "block_update" in those instructions.
    name: str = "test_tool"
    description: str = "Used for testing that the tools support is working"
    
    args_schema: Type[BaseModel] = DummyTestToolInput
    return_direct: bool = True # todo-0: What does this mean? I'm guessing it means that the tool returns the result directly
    
    def __init__(self, description):
        super().__init__(description=description)
        print(f"Created DummyTestTool as {description}")

    def _run(self, input: str) -> str:
        """Use the tool."""
        print(f"DummyTestTool: {input}")
        return "Return val from DummyTestTool2 with input: "+input

if __name__ == "__main__":
    print("Quanta Gradio Starting...")
    
    # NOTE: You can remove this line of code as long as you just supply the correct 'model' and 'api_key' values on the line below.
    AppConfig.init_config()
    
    # todo-0: We have a problem here that this returns something other than BaseLanguageModel
    llm = ChatOpenAI(
                    model=AppConfig.cfg.openai_model, # type: ignore
                    temperature=1.0,
                    api_key=AppConfig.cfg.openai_api_key,
                    timeout=120
                ) 
    
    tools = [DummyTestTool("My Dummy Test Tool")]
    
    chat_prompt_template = ChatPromptTemplate.from_messages([
        SystemMessage(content="You are a helpful assistant with access to the following tools:"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
        HumanMessagePromptTemplate.from_template("Human: {input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])
    
    agent = create_openai_tools_agent(llm, tools, chat_prompt_template)
    agent_executor = AgentExecutor(agent=agent, tools=tools).with_config({"run_name": "Agent"})

    async def queryAI(prompt, messages):
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
    