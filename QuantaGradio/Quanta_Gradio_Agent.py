"""Runs a basic ChatBot using Gradio interface.

You can use this as the simplest possible test to verify that Gradio is working.

NOTE: This file is now a work in progress and is what will eventually be the GUI app which can 
run the Quanta Coding Agent. For now, all we've done in this file is demonstrate that we can run
a basic ChatBot using Gradio and with a basic test tool.
"""

import sys
import os
import gradio as gr

ABS_FILE = os.path.abspath(__file__)
PRJ_DIR = os.path.dirname(os.path.dirname(ABS_FILE))
sys.path.append(PRJ_DIR)

from app_config import AppConfig
from common.python.agent.ai_utils import AIUtils
from common.python.utils import Utils
from common.python.agent.app_agent import QuantaAgent
from langchain.chat_models.base import BaseChatModel

if __name__ == "__main__":
    Utils.init_logging("./quanta_ai.log")
    print("Quanta Gradio Agent Starting...")
    AppConfig.init_config()

    async def query_ai(prompt, messages):
        llm: BaseChatModel = AIUtils.create_llm(1.0, AppConfig.cfg)

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
            
        submit_button.click(query_ai, [input, chatbot], [chatbot, input])
        clear_button.click(clear_history, [], [chatbot])
    
    demo.launch()         
    