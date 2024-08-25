"""This is the main agent module that scans the source code and generates the AI prompt."""

import os
import time
from typing import List, Set
from .project_loader import ProjectLoader
from .project_mutator import ProjectMutator
from langchain.schema import HumanMessage, AIMessage, BaseMessage, SystemMessage, BaseMessage
from langchain.chat_models.base import BaseChatModel
from langgraph.prebuilt import chat_agent_executor
from ..utils import RefactorMode, Utils
from .refactoring_tools import (
    UpdateBlockTool,
    CreateFileTool,
    UpdateFileTool
)
from ..file_utils import FileUtils
from .tags import (
    TAG_BLOCK_BEGIN,
    TAG_BLOCK_END,
    MORE_INSTRUCTIONS,
)
from ..utils import RefactorMode
from .prompt_utils import PromptUtils


class QuantaAgent:
    """Scans the source code and generates the AI prompt."""

    def __init__(self):
        self.ts: str = str(int(time.time() * 1000))
        self.answer: str = ""
        self.mode = RefactorMode.NONE.value
        self.prompt: str = ""
        self.system_prompt: str = ""
        self.has_filename_inject = False
        self.has_folder_inject = False
        self.prj_loader = None
        self.source_folder = ""
        self.data_folder = ""
        self.dry_run: bool = False
    
    def run(
        self,
        ai_service: str,
        mode: str,
        output_file_name: str,
        messages: List[BaseMessage],
        input_prompt: str,
        source_folder: str,
        data_folder: str,
        ext_set: Set[str],
        llm: BaseChatModel
    ):
        """Runs the agent. We assume that if messages is not `None` then we are in the Streamlit GUI mode, and these messages
        represent the chatbot context. If messages is `None` then we are in the CLI mode, and we will use the `prompt` parameter
        alone without any prior context."""
        self.data_folder = data_folder
        self.source_folder = source_folder
        self.source_folder_len: int = len(source_folder)
        self.prj_loader = ProjectLoader(self.source_folder_len, ext_set)
        self.prompt = input_prompt
        self.mode = mode
        self.ext_set = ext_set

        # default filename to timestamp if empty
        if output_file_name == "":
            output_file_name = self.ts

        # Scan the source folder for files with the specified extensions, to build up the 'blocks' dictionary
        self.prj_loader.scan_directory(self.source_folder)

        self.insert_blocks_into_prompt()
        self.insert_files_and_folders_into_prompt()
        self.build_system_prompt()

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

            if self.mode != RefactorMode.NONE.value:
                # https://python.langchain.com/v0.2/docs/tutorials/agents/
                tools = []

                if self.mode == RefactorMode.REFACTOR.value:
                    tools = [
                        UpdateBlockTool("Block Updater Tool", self.prj_loader.blocks),
                        CreateFileTool("File Creator Tool", self.source_folder),
                        UpdateFileTool("File Updater Tool", self.source_folder),
                    ]

                agent_executor = chat_agent_executor.create_tool_calling_executor(
                    llm, tools
                )
                initial_message_len = len(messages)
                response = agent_executor.invoke({"messages": messages})
                # print(f"Response: {response}")
                resp_messages = response["messages"]
                new_messages = resp_messages[initial_message_len:]
                self.answer = ""
                ai_response: int = 0
                
                # Scan all the new messages for AI responses, which may contain tool calls
                for message in new_messages:
                    if isinstance(message, AIMessage):
                        ai_response += 1
                        content = message.content
                        if not content:
                            content = Utils.get_tool_calls_str(message)
                            # print(f"TOOL CALLS:\n{content}")
                        self.answer += f"AI Response {ai_response}:\n{content}\n\n==============\n\n"  # type: ignore

                # Agents may add multiple new messages, so we need to update the messages list
                # This [:] syntax is a way to update the list in place
                messages[:] = resp_messages

            else:
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

        if self.mode == RefactorMode.REFACTOR.value:
            ProjectMutator(
                self.mode,
                self.source_folder,
                self.answer,
                self.ts,
                None,
                self.prj_loader.blocks,
                self.ext_set
            ).run()

    def build_system_prompt(self):
        """Adds all the instructions to the prompt. This includes instructions for inserting blocks, files,
        folders, and creating files.

        WARNING: This method modifies the `prompt` attribute of the class to have already been configured, and
        also really everything else that this class sets up, so this method should be called last, just before
        the AI query is made.
        """

        self.system_prompt = PromptUtils.get_template(
            "../common/python/agent/prompt_templates/agent_system_prompt.txt"
        )
        self.system_prompt += MORE_INSTRUCTIONS
        self.add_file_handling_instructions()
        self.add_block_handling_instructions()


    def add_block_handling_instructions(self):
        """Adds instructions for updating blocks. If the prompt contains ${BlockName} tags, then we need to provide
        instructions for how to provide the new block content."""
        if self.mode == RefactorMode.REFACTOR.value and len(self.prj_loader.blocks) > 0:
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
           

    def insert_files_and_folders_into_prompt(self) -> bool:
        """Inserts the file and folder names into the prompt. Prompts can contain ${FileName} and ${FolderName/} tags

        Returns true only if some files or folders were inserted.
        """
        self.prompt, self.has_filename_inject = PromptUtils.insert_files_into_prompt(
            self.prompt, self.source_folder, self.prj_loader.file_names
        )
        self.prompt, self.has_folder_inject = PromptUtils.insert_folders_into_prompt(
            self.prompt, self.source_folder, self.prj_loader.folder_names, self.ext_set
        )
        return self.has_filename_inject or self.has_folder_inject


    def insert_blocks_into_prompt(self) -> bool:
        """
        Substitute blocks into the prompt. Prompts can contain ${BlockName} tags, which will be replaced with the
        content of the block with the name 'BlockName'

        Returns true only if someblocks were inserted.
        """
        # As performance boost, if self.prompt does not contain "block(" then return False
        if "block(" not in self.prompt:
            return False
        
        ret = False
        for key, value in self.prj_loader.blocks.items():
            k = f"block({key})"
            if k in self.prompt:
                ret = True

            self.prompt = self.prompt.replace(
                k,
                f"""
{TAG_BLOCK_BEGIN} {key}
{value.content}
{TAG_BLOCK_END}
""",
            )
            
            # If no more 'block(' tags are in prompt, then we can break out of the loop
            if "block(" not in self.prompt:
                break
            
        return ret
