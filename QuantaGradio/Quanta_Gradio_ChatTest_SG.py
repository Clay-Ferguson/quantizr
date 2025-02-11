"""Runs a basic ChatBot using Gradio interface and a true "Lang Graph" (StateGraph).

https://langchain-ai.github.io/langgraph/tutorials/introduction/#part-1-build-a-basic-chatbot
"""

import sys
import os
import gradio as gr
from langchain.schema import HumanMessage

from typing import Annotated

from typing_extensions import TypedDict

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages

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
    
    class State(TypedDict):
        # Messages have the type "list". The `add_messages` function
        # in the annotation defines how this state key should be updated
        # (in this case, it appends messages to the list, rather than overwriting them)
        messages: Annotated[list, add_messages]

    graph_builder = StateGraph(State)
    
    llm = AIUtils.create_llm(0.7, AppConfig.cfg)
    
    def chatbot(state: State):
        return {"messages": [llm.invoke(state["messages"])]}

    graph_builder.add_node("chatbot", chatbot)
    graph_builder.add_edge(START, "chatbot")
    graph_builder.add_edge("chatbot", END)
    graph = graph_builder.compile()

    async def query_ai(prompt, messages):
        chat_history = AIUtils.gradio_messages_to_langchain(messages)
        chat_history.append(HumanMessage(content=prompt))    
        messages.append(gr.ChatMessage(role="user", content=prompt))
        yield messages, ""
        
        async for chunk in graph.astream({"messages": chat_history}):
            AIUtils.handle_agent_response_item(chunk, messages, True)
            yield messages, ""   
                
        yield messages, "" 

    with gr.Blocks() as demo:
        gr.Markdown("# Chat Agent Test (with State Graph)")
        bot = gr.Chatbot(
            type="messages",
            label="Agent",
            avatar_images=(None, "assets/logo-100px-tr.jpg"),
        )
        
        input = gr.Textbox(lines=1, label="Chat Message")
        input.submit(query_ai, [input, bot], [bot, input])

    demo.launch()
