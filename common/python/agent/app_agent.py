"""This is the main agent module that scans the source code and generates the AI prompt."""

import os
import sys
import time
from typing import List, Set
from gradio import ChatMessage
from langchain.schema import HumanMessage, SystemMessage, AIMessage, BaseMessage
from langchain.chat_models.base import BaseChatModel
from langgraph.prebuilt import chat_agent_executor
from ..utils import RefactorMode
from .refactoring_tools import (
    GetBlockInfoTool,
    UpdateBlockTool,
    CreateFileTool,
    ReadFileTool,
    WriteFileTool, 
    DirectoryListingTool
)
from ..file_utils import FileUtils
from ..utils import RefactorMode
from .prompt_utils import PromptUtils

ABS_FILE = os.path.abspath(__file__)
PRJ_DIR = os.path.dirname(os.path.dirname(ABS_FILE))
sys.path.append(PRJ_DIR)

from common.python.agent.ai_utils import AIUtils

class QuantaAgent:
    """Scans the source code and generates the AI prompt."""

    def __init__(self):
        self.ts: str = str(int(time.time() * 1000))
        self.answer: str = ""
        self.mode = RefactorMode.NONE.value
        self.prompt: str = ""
        self.prompt_code: str = ""
        self.system_prompt: str = ""
        self.source_folder = ""
        self.folders_to_include: List[str] = []
        self.folders_to_exclude: List[str] = []
        self.data_folder = ""
        self.dry_run: bool = False
    
    def run(
        self,
        user_system_prompt: str,
        ai_service: str,
        mode: str,
        output_file_name: str,
        messages: List[BaseMessage],
        input_prompt: str,
        source_folder: str,
        folders_to_include: List[str],
        folders_to_exclude: List[str],
        data_folder: str,
        ext_set: Set[str],
        llm: BaseChatModel
    ):
        """Runs the AI/Agent when called from the Quanta Web app
        """
        self.data_folder = data_folder
        self.source_folder = source_folder
        self.folders_to_include = folders_to_include
        self.folders_to_exclude = folders_to_exclude
        self.prompt = input_prompt
        self.mode = mode
        self.ext_set = ext_set

        # default filename to timestamp if empty
        if output_file_name == "":
            output_file_name = self.ts
        
        if (self.prompt_code): 
            self.prompt += "\n<code>\n" + self.prompt_code + "\n</code>\n"

        raw_prompt = self.prompt
        self.build_system_prompt(user_system_prompt)

        if self.dry_run:
            # If dry_run is True, we simulate the AI response by reading from a file
            # if we canfind that file or else we return a default response.
            answer_file: str = f"{self.data_folder}/dry-run-answer.txt"

            if os.path.isfile(answer_file):
                print(f"Simulating AI Response by reading answer from {answer_file}")
                self.answer = FileUtils.read_file(answer_file)
            else:
                self.answer = "Dry Run: No API call made."
        else:
            # Check the first 'message' to see if it's a SystemMessage and if not then insert one
            if len(messages) == 0 or not isinstance(messages[0], SystemMessage):
                messages.insert(0, SystemMessage(content=self.system_prompt))
            # else we set the first message to the system prompt
            else:
                messages[0] = SystemMessage(content=self.system_prompt)

            self.human_message = HumanMessage(content=self.prompt)
            messages.append(self.human_message)
            use_tools = True

            if use_tools and self.mode != RefactorMode.NONE.value:
                tools = []

                # todo-0: We need a class called FileSetInfo which packages up (source_folder, folders_to_include, folders_to_exclude, ext_set)
                # todo-0: createing these 'tools' needs to be in a separate method probably INSIDE the file they're defined in.
                if self.mode == RefactorMode.REFACTOR.value:
                    tools = [
                        GetBlockInfoTool(self.source_folder, self.folders_to_include, self.folders_to_exclude, self.ext_set),
                        UpdateBlockTool(self.source_folder, self.folders_to_include, self.folders_to_exclude, self.ext_set),
                        CreateFileTool(self.source_folder),
                        WriteFileTool(self.source_folder),
                        ReadFileTool(self.source_folder),
                        DirectoryListingTool(self.source_folder, self.folders_to_include, self.folders_to_exclude, self.ext_set)
                    ]
                    print("Created Agent Tools")
                    
                agent_executor = chat_agent_executor.create_tool_calling_executor(llm, tools)
                initial_message_len = len(messages)
                response = agent_executor.invoke({"messages": messages})
                # print(f"Response: {response}") This prints too much
                resp_messages = response["messages"]
                new_messages = resp_messages[initial_message_len:]
                self.answer = ""
                resp_idx: int = 0
                
                # Scan all the new messages for AI responses, which may contain tool calls
                for message in new_messages:
                    if isinstance(message, AIMessage):
                        resp_idx += 1
                        # print(f"AI Response {resp_idx}:")
                        # pprint.pprint(message)
                        self.answer = self.append_message(message, self.answer)
                           
                # Agents may add multiple new messages, so we need to update the messages list
                # This [:] syntax is a way to update the list in place
                messages[:] = resp_messages
            else:
                print("Running without tools")
                response = llm.invoke(messages)
                self.answer = response.content  # type: ignore
                messages.append(AIMessage(content=response.content))

        output = f"""AI Model Used: {ai_service}, Mode: {self.mode}, Timestamp: {self.ts}
____________________________________________________________________________________
Input Prompt: 
{input_prompt}
____________________________________________________________________________________
LLM Output: 
{self.answer}
____________________________________________________________________________________
System Prompt: 
{self.system_prompt}
____________________________________________________________________________________
Final Prompt: 
{self.prompt}
"""

        filename = f"{self.data_folder}/{output_file_name}.txt"
        FileUtils.write_file(filename, output)
        print(f"Wrote Log File: {filename}")

    async def run_gradio(
        self,
        ai_service: str,
        output_file_name: str,
        messages,
        show_tool_usage: bool, 
        input_prompt: str,
        source_folder: str,
        folders_to_include: List[str],
        folders_to_exclude: List[str],
        data_folder: str,
        ext_set: Set[str],
        llm: BaseChatModel,
    ):
        """Runs the AI/Agent from a Gradio UI.
        """
        self.data_folder = data_folder
        self.source_folder = source_folder
        self.folders_to_include = folders_to_include
        self.folders_to_exclude = folders_to_exclude
        self.prompt = input_prompt
        self.mode = RefactorMode.REFACTOR.value
        self.ext_set = ext_set

        # default filename to timestamp if empty
        if output_file_name == "":
            output_file_name = self.ts
        
        self.build_system_prompt("")

        tools = [
            GetBlockInfoTool(self.source_folder, self.folders_to_include, self.folders_to_exclude, self.ext_set),
            UpdateBlockTool(self.source_folder, self.folders_to_include, self.folders_to_exclude, self.ext_set),
            CreateFileTool(self.source_folder),
            WriteFileTool(self.source_folder),
            ReadFileTool(self.source_folder),
            DirectoryListingTool(self.source_folder, self.folders_to_include, self.folders_to_exclude, self.ext_set)
        ]
                
        # Convert messages to a format the agent can understand
        chat_history = []
        idx = 0        
        for msg in messages:
            if msg['role'] == "user":
                chat_history.append(HumanMessage(content=msg['content']))
                idx += 1 
            elif msg['role'] == "assistant":
                chat_history.append(AIMessage(content=msg['content']))

        agent_executor = chat_agent_executor.create_tool_calling_executor(llm, tools)
        chat_history.append(HumanMessage(content=self.prompt))    
        messages.append(ChatMessage(role="user", content=self.prompt))
        yield messages
        
        print("Processing agent responses...")
        async for chunk in agent_executor.astream({"messages": chat_history}):
            AIUtils.handle_agent_response_item(chunk, messages, show_tool_usage)
            yield messages            
            
        output = f"""AI Model Used: {ai_service}, Mode: {self.mode}, Timestamp: {self.ts}
____________________________________________________________________________________
Input Prompt: 
{input_prompt}
____________________________________________________________________________________
LLM Output: 
{self.answer}
____________________________________________________________________________________
System Prompt: 
{self.system_prompt}
____________________________________________________________________________________
Final Prompt: 
{self.prompt}
"""

        filename = f"{self.data_folder}/{output_file_name}.txt"
        FileUtils.write_file(filename, output)
        print(f"Wrote Log File: {filename}")

    def append_message(self, message: AIMessage, answer: str) -> str:
        if isinstance(message.content, str):
            answer += message.content + "\n"
        else:
            if isinstance(message.content, list): 
                # if message.content is a list
                for item in message.content:
                    if isinstance(item, dict) and "type" in item and item["type"] == "tool_use":
                        answer += "Tool Used: " + item["name"] + "\n"
                    elif isinstance(item, dict) and "text" in item:
                        answer += item["text"] + "\n"
                    else:
                        answer += str(item) + "\n"
        return answer

    def get_file_type_mention(self, ext: str) -> str:
        file_type = ""
        if ext == ".py":
            file_type = "Python"
        elif ext == ".js":
            file_type = "JavaScript"
        elif ext == ".html":
            file_type = "HTML"
        elif ext == ".css":
            file_type = "CSS"
        elif ext == ".json":
            file_type = "JSON"
        elif ext == ".txt":
            file_type = "Text"
        elif ext == ".md":
            file_type = "Markdown"
        elif ext == ".java":
            file_type = "Java"
        
        if file_type:
            return f"\nI'm working in a {file_type} file. "
        return ""

    def build_system_prompt(self, user_system_prompt: str):
        """Adds all the instructions to the prompt. This includes instructions for inserting blocks, files,
        folders, and creating files.

        WARNING: This method modifies the `prompt` member of the class to have already been configured, and
        also really everything else that this class sets up, so this method should be called last, just before
        the AI query is made.
        """

        self.system_prompt = PromptUtils.get_template(
            "../common/python/agent/prompt_templates/agent_system_prompt.md"
        )
        
        # Users themselves may have provided a system prompt so add that if so.
        if user_system_prompt:
            self.system_prompt += f"\n----\nGeneral Instructions:\n{user_system_prompt}"


    def add_block_handling_instructions(self):
        """Adds instructions for updating blocks. If the prompt contains ${BlockName} tags, then we need to provide
        instructions for how to provide the new block content."""
        if self.mode == RefactorMode.REFACTOR.value:
            self.system_prompt += PromptUtils.get_template(
                "../common/python/agent/prompt_templates/block_access_instructions.txt"
            )
            
            self.system_prompt += PromptUtils.get_template(
                "../common/python/agent/prompt_templates/block_update_instructions.txt"
            )
           

    def add_file_handling_instructions(self):
        """Adds instructions for inserting files. If the prompt contains ${FileName} or ${FolderName/} tags, then
        we need to provide instructions for how to provide the new file or folder names.
        """
        if self.mode == RefactorMode.REFACTOR.value:
            self.system_prompt += PromptUtils.get_template(
                "../common/python/agent/prompt_templates/file_access_instructions.txt"
            )
            
            self.system_prompt += PromptUtils.get_template(
                "../common/python/agent/prompt_templates/file_edit_instructions.txt"
            )

