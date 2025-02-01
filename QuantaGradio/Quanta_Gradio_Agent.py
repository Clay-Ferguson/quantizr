"""Runs a ChatBot using Gradio interface, with access to the QuantAgent for code refactoring.

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
    print("Quanta Gradio Agent Starting...")
    Utils.check_conda_env("quanta_gradio")
    full_prompts = []
    
    AppConfig.init_config()    
    Utils.init_logging(f"{AppConfig.cfg.data_folder}/Quanta_Gradio_Agent.log")

    async def query_ai(prompt, messages):
        """# Runs an LLM inference (calls the AI) which can answer questions and/or refactor code using the tools
        """
        
        # Get the LLM based on which model the Config calls for. We use a temperature of 1.0 for no creativity at all but only
        # always the most likely next tokens, and hopefully best code generation.
        llm: BaseChatModel = AIUtils.create_llm(0.0, AppConfig.cfg)

        agent = QuantaAgent()
        
        # Calls the AI and does all the work of getting the response messages back, as the return value
        async for result in agent.run_gradio(
            AppConfig.cfg.ai_service,
            "", # output_file_name
            messages,
            full_prompts,
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
        full_prompts = []
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
    