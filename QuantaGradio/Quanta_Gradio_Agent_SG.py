"""Runs a ChatBot using Gradio interface, with access to the QuantAgent for code refactoring, using StateGraph (SG)

https://langchain-ai.github.io/langgraph/tutorials/introduction/#requirements

"""

import sys
import os
import gradio as gr
from langgraph.graph import StateGraph, START, END

ABS_FILE = os.path.abspath(__file__)
PRJ_DIR = os.path.dirname(os.path.dirname(ABS_FILE))
sys.path.append(PRJ_DIR)

from app_config import AppConfig
from common.python.agent.ai_utils import AIUtils
from common.python.utils import Utils
from common.python.agent.app_agent import QuantaAgent
from langchain.chat_models.base import BaseChatModel

from common.python.agent.refactoring_tools import (
    init_tools
)

from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph import StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition

if __name__ == "__main__":
    print("Quanta Gradio Agent Starting...")
    Utils.check_conda_env("quanta_gradio")
    
    AppConfig.init_config()    
    Utils.init_logging(f"{AppConfig.cfg.data_folder}/Quanta_Gradio_Agent.log")

    class State(TypedDict):
        messages: Annotated[list, add_messages]

    graph_builder = StateGraph(State)
    graph = None

    async def query_ai(prompt, messages, show_tool_usage):
        """# Runs an LLM inference (calls the AI) which can answer questions and/or refactor code using the tools
        """
        
        global graph
        
        # Get the LLM based on which model the Config calls for. We use a temperature of 1.0 for no creativity at all but only
        # always the most likely next tokens, and hopefully best code generation.
        llm: BaseChatModel = AIUtils.create_llm(0.0, AppConfig.cfg)
        agent = QuantaAgent()
        
        if QuantaAgent.tool_set is None:
            QuantaAgent.tool_set = init_tools(AppConfig.file_sources)
            
        llm_with_tools = llm.bind_tools(QuantaAgent.tool_set)
        
        if (graph is None):
            def chatbot(state: State):
                return {"messages": [llm_with_tools.invoke(state["messages"])]}

            graph_builder.add_node("chatbot", chatbot)

            tool_node = ToolNode(tools=QuantaAgent.tool_set)
            graph_builder.add_node("tools", tool_node)

            graph_builder.add_conditional_edges(
                "chatbot",
                tools_condition,
            )
            # Any time a tool is called, we return to the chatbot to decide the next step
            graph_builder.add_edge("tools", "chatbot")
            graph_builder.set_entry_point("chatbot")
            graph = graph_builder.compile()
        
        
        # Calls the AI and does all the work of getting the response messages back, as the return value
        async for result in agent.run_lang_graph(
            AppConfig.cfg.ai_service,
            "", # output_file_name
            messages,
            show_tool_usage,
            prompt,
            AppConfig.file_sources,
            graph
        ):
            # Handle each yielded result
            if isinstance(result, list):
                messages = result
                
        yield messages, ""

    def clear_history():
        return []

    # This 'logo' isn't being used, but I leave this in place for future reference in case we
    # need sayling like this later.
    css = """
.logo {
    width: 100px;
    height: 100px;
    margin-right: 1rem;
}
"""

    with gr.Blocks(css=css) as demo:
        #with gr.Row():
            # todo-2: Tried to add an image, and it works but I can't control width. Will come back to this later.
            # gr.Image("assets/logo-100px-tr.jpg", width="100px", height="100px")
        gr.Markdown("#### Quanta Coding Agent")
        
        chatbot = gr.Chatbot(
            type="messages",
            label="Agent",
            avatar_images=(None, "assets/logo-100px-tr.jpg")
        )
        input = gr.Textbox(lines=5, label="Chat Message", placeholder="Type your message here...")
        
        with gr.Row():
            submit_button = gr.Button("Submit")
            clear_button = gr.Button("Clear")
            show_tool_usage = gr.Checkbox(label="Show Tool Usage", value=True)
            
        submit_button.click(query_ai, [input, chatbot, show_tool_usage], [chatbot, input])
        clear_button.click(clear_history, [], [chatbot])
    
    demo.launch()         
