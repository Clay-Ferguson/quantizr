"""Runs a ChatBot using Gradio interface, with access to the QuantAgent for code refactoring, using StateGraph (SG)

https://langchain-ai.github.io/langgraph/tutorials/introduction/#requirements

"""
import sys
import os
import gradio as gr
from langgraph.graph import StateGraph

ABS_FILE = os.path.abspath(__file__)
PRJ_DIR = os.path.dirname(os.path.dirname(ABS_FILE))
sys.path.append(PRJ_DIR)

from app_config import AppConfig

# WARNING: 'common' folder won't be known at runtime until the path append above is done!
from common.python.string_utils import StringUtils
from common.python.folder_monitor import FolderMonitor
from common.python.agent.ai_utils import AIUtils, init_tools
from common.python.utils import Utils
from common.python.agent.app_agent import QuantaAgent
from langchain.chat_models.base import BaseChatModel

from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph import StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition

class State(TypedDict):
    messages: Annotated[list, add_messages]

class QuantaGradioAgent:
    def __init__(self):
        # Constants
        self.DEFAULT_AGENT = "Quanta Coding Agent"
        self.SELECT = "Select"
        
        # State variables
        self.graph_builder = StateGraph(State)
        self.graph = None
        self.system_prompt = ""
        self.monitor = None
        
        print("Quanta Gradio Agent Starting...")
        Utils.check_conda_env("quanta_gradio")
        
        AppConfig.init_config()    
        Utils.init_logging(f"{AppConfig.cfg.data_folder}/Quanta_Gradio_Agent.log")
        
        self.monitor = FolderMonitor(AppConfig.file_sources)
        self.monitor.start()

    async def query_ai(self, prompt, messages, show_tool_usage):
        """# Runs an LLM inference (calls the AI) which can answer questions and/or refactor code using the tools
        """
        # Get the LLM based on which model the Config calls for. We use a temperature of 1.0 for no creativity at all but only
        # always the most likely next tokens, and hopefully best code generation.
        llm: BaseChatModel = AIUtils.create_llm(0.0, AppConfig.cfg)
        agent = QuantaAgent()
        
        if QuantaAgent.tool_set is None:
            QuantaAgent.tool_set = init_tools(AppConfig.file_sources)
            
        llm_with_tools = llm.bind_tools(QuantaAgent.tool_set)
        
        if (self.graph is None):
            def chatbot(state: State):
                return {"messages": [llm_with_tools.invoke(state["messages"])]}

            self.graph_builder.add_node("chatbot", chatbot)

            tool_node = ToolNode(tools=QuantaAgent.tool_set)
            self.graph_builder.add_node("tools", tool_node)

            self.graph_builder.add_conditional_edges(
                "chatbot",
                tools_condition,
            )
            # Any time a tool is called, we return to the chatbot to decide the next step
            self.graph_builder.add_edge("tools", "chatbot")
            self.graph_builder.set_entry_point("chatbot")
            self.graph = self.graph_builder.compile()
        
        # Calls the AI and does all the work of getting the response messages back, as the return value
        async for result in agent.run_lang_graph(
            self.system_prompt,
            AppConfig.cfg.ai_service,
            "", # output_file_name
            messages,
            show_tool_usage,
            prompt,
            AppConfig.file_sources,
            self.graph
        ):
            # Handle each yielded result
            if isinstance(result, list):
                messages = result
                
        yield messages, ""

    def clear_history(self):
        return []
        
    def get_prompt_files(self, sub_folder: str, default_file_name: str):
        """Get list of files from the prompt folder"""
        prompt_dir = AppConfig.file_sources.prompts_folder+"/"+sub_folder
        if not os.path.exists(prompt_dir):
            return None
            
        files = [f for f in os.listdir(prompt_dir) if os.path.isfile(os.path.join(prompt_dir, f))]
        # Return None if no files, otherwise return the list with default option
        return None if len(files) == 0 else [default_file_name] + files

    def load_prompt_content(self, filename, sub_folder: str, default_file_name: str):
        """Load content of selected prompt file into input box, removing meta sections"""
        if filename == default_file_name:
            return ""
            
        prompt_dir = AppConfig.file_sources.prompts_folder+"/"+sub_folder
        file_path = os.path.join(prompt_dir, filename)
        
        try:
            # read the file content into a string, process it, and return it
            with open(file_path, "r") as file:
                content = file.read()
                content = StringUtils.post_process_template(content)
                return content
        except Exception as e:
            print(f"Error loading prompt file: {e}")
            return f"Error loading file: {e}"

    # Handler for agent prompt selection
    def handle_agent_prompt_selection(self, filename):
        if filename != self.DEFAULT_AGENT:
            self.system_prompt = self.load_prompt_content(filename, "agents", self.DEFAULT_AGENT)
            
        return filename

    def run(self):
        # This 'logo' isn't being used, but I leave this in place for future reference in case we
        # need styling like this later.
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
            
            with gr.Row():
                # Check if agent prompt files exist
                agent_prompt_files = self.get_prompt_files("agents", self.DEFAULT_AGENT)
                
                # Only add dropdown if agent prompt files exist
                if agent_prompt_files:
                    agent_prompt_dropdown = gr.Dropdown(
                        choices=agent_prompt_files,
                        label="Agent (System Prompt)",
                        value=self.DEFAULT_AGENT
                    )
                    # Add change handler to print selected filename
                    agent_prompt_dropdown.change(
                        fn=self.handle_agent_prompt_selection,
                        inputs=agent_prompt_dropdown,
                        outputs=agent_prompt_dropdown  # Not actually changing anything, just need an output
                    )
                    
                # Check if user prompt files exist
                user_prompt_files = self.get_prompt_files("user", self.SELECT)
                
                # Only add dropdown if user prompt files exist
                if user_prompt_files:
                    user_prompt_dropdown = gr.Dropdown(
                        choices=user_prompt_files,
                        label="Prompt",
                        value=self.SELECT
                    )
            
            input = gr.Textbox(lines=5, label="Chat Message", placeholder="Type your message here...")
            
            # Connect user dropdown to input textbox only if it exists
            if user_prompt_files:
                user_prompt_dropdown.change(
                    fn=lambda dropdown: self.load_prompt_content(dropdown, "user", self.SELECT),
                    inputs=user_prompt_dropdown, 
                    outputs=input
                )
            
            with gr.Row():
                submit_button = gr.Button("Submit")
                clear_button = gr.Button("Clear")
                show_tool_usage = gr.Checkbox(label="Show Tool Usage", value=True)
                
            submit_button.click(self.query_ai, [input, chatbot, show_tool_usage], [chatbot, input])
            clear_button.click(self.clear_history, [], [chatbot])
        
        demo.launch()


if __name__ == "__main__":
    agent = QuantaGradioAgent()
    agent.run()
