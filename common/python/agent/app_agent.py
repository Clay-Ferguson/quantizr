"""This is the main agent module that scans the source code and generates the AI prompt."""

import os
import re
import time
from typing import List, Set
from .project_loader import ProjectLoader
from .project_mutator import ProjectMutator
from gradio import ChatMessage
from langchain.prompts import ChatPromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder
from langchain.schema import HumanMessage, SystemMessage, AIMessage, BaseMessage
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain.chat_models.base import BaseChatModel
from langgraph.prebuilt import chat_agent_executor
from ..utils import RefactorMode
from .refactoring_tools import (
    UpdateBlockTool,
    CreateFileTool,
    UpdateFileTool
)
from ..file_utils import FileUtils
from .tags import (
    TAG_BLOCK_BEGIN,
    TAG_BLOCK_END,
    AGENT_INSTRUCTIONS,
    GENERAL_INSTRUCTIONS
)
from ..utils import RefactorMode
from .prompt_utils import PromptUtils


class QuantaAgent:
    """Scans the source code and generates the AI prompt."""
    
    prj_loader: ProjectLoader | None
    ok_hal: str

    def __init__(self):
        self.ts: str = str(int(time.time() * 1000))
        self.answer: str = ""
        self.mode = RefactorMode.NONE.value
        self.prompt: str = ""
        self.prompt_code: str = ""
        self.system_prompt: str = ""
        self.prj_loader = None
        self.source_folder = ""
        self.folders_to_include: List[str] = []
        self.folders_to_exclude: List[str] = []
        self.data_folder = ""
        self.dry_run: bool = False
        self.parse_prompt: bool = False
    
    def run(
        self,
        user_system_prompt: str,
        ai_service: str,
        mode: str,
        output_file_name: str,
        messages: List[BaseMessage],
        input_prompt: str,
        parse_prompt: bool,
        source_folder: str,
        folders_to_include: List[str],
        folders_to_exclude: List[str],
        data_folder: str,
        ext_set: Set[str],
        llm: BaseChatModel,
        ok_hal: str
    ):
        self.data_folder = data_folder
        self.source_folder = source_folder
        self.source_folder_len: int = len(source_folder)
        self.folders_to_include = folders_to_include
        self.folders_to_exclude = folders_to_exclude
        self.prj_loader = ProjectLoader(self.source_folder_len, ext_set, folders_to_include, folders_to_exclude, parse_prompt, ok_hal)
        self.prompt = input_prompt
        self.parse_prompt = parse_prompt
        self.ok_hal = ok_hal
        self.mode = mode
        self.ext_set = ext_set

        # default filename to timestamp if empty
        if output_file_name == "":
            output_file_name = self.ts

        # Scan the source folder for files with the specified extensions, to build up the 'blocks' dictionary
        self.prj_loader.scan_directory(self.source_folder)
        
        if self.parse_prompt: 
            if not self.prj_loader.parsed_prompt:
                raise Exception("Oops. No 'ok hal' prompt was found in the source files, or else no '?' terminator line after the prompt.")
            
            if (self.prj_loader.file_with_prompt):
                # get file extension from file_with_prompt filename
                ext = os.path.splitext(self.prj_loader.file_with_prompt)[1]
                self.prompt = self.prompt + self.get_file_type_mention(ext);
        
        # if we just got our prompt from scanning files then set it in self.prompt
        if (self.prj_loader.parsed_prompt):
            self.prompt, self.prompt_code = self.parse_prompt_and_code(self.prj_loader.parsed_prompt)
        
        if (self.prompt_code): 
            self.prompt += "\n<code>\n" + self.prompt_code + "\n</code>\n"

        raw_prompt = self.prompt

        self.prompt = self.insert_blocks_into_prompt(self.prompt)
        self.prompt = PromptUtils.insert_files_into_prompt(
            self.prompt, self.source_folder, self.prj_loader.file_names
        )
        self.prompt = PromptUtils.insert_folders_into_prompt(
            self.prompt, self.source_folder, self.folders_to_include, self.folders_to_exclude, self.ext_set
        )
        
        if user_system_prompt:
            user_system_prompt = self.insert_blocks_into_prompt(user_system_prompt)
            user_system_prompt = PromptUtils.insert_files_into_prompt(
                user_system_prompt, self.source_folder, self.prj_loader.file_names
            )
            user_system_prompt = PromptUtils.insert_folders_into_prompt(
                user_system_prompt, self.source_folder, self.folders_to_include, self.folders_to_exclude, self.ext_set
            )
        
        # ========================================================================================================
        # DO NOT DELETE:
        # 
        # These prompots were initially used in the 'ok hal' scenario where I only wanted to be able to ask questions about a specific
        # file and have the context only be about the provided code within the 'ok hal' block, but then I decided I wanted the 'ok hal' 
        # to be able to do FULL refactoring of code, just like the Quanta Agent does, so I decided to always use the  `build_system_prompt`
        # call here to give those full instructions.
        # I leave this block commented out here for now, because later on we can theoretically have another additional syntax in additionto
        # the 'ok hal' syntax, which would be a more limited syntax that only allows for asking questions about the provided code only
        # if (self.parse_prompt): 
        #     if (self.prompt_code):  
        #         self.system_prompt = PromptUtils.get_template(
        #             "../common/python/agent/prompt_templates/okhal_system_prompt_with_code.txt"
        #         )
        #     else:
        #         self.system_prompt = PromptUtils.get_template(
        #             "../common/python/agent/prompt_templates/okhal_system_prompt.txt"
        #         )
        # else:
        #     self.build_system_prompt(user_system_prompt)
        # ========================================================================================================
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
            
            # default to using tools if we are not parsing the prompt
            use_tools = not self.parse_prompt
                        
            # but if we mention any blocks, files or folders in the prompt then we must use tools
            if not use_tools and ("block(" in raw_prompt or "file(" in raw_prompt or "folder(" in raw_prompt):
                use_tools = True

            if use_tools and self.mode != RefactorMode.NONE.value:
                # https://python.langchain.com/v0.2/docs/tutorials/agents/
                tools = []

                if self.mode == RefactorMode.REFACTOR.value:
                    tools = [
                        UpdateBlockTool("Block Updater Tool", self.prj_loader.blocks),
                        CreateFileTool("File Creator Tool", self.source_folder),
                        UpdateFileTool("File Updater Tool", self.source_folder),
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

        if self.parse_prompt and self.answer:
            self.inject_answer(self.prj_loader.file_with_prompt, self.answer, self.ok_hal)
            
        if self.mode == RefactorMode.REFACTOR.value:
            ProjectMutator(
                self.mode,
                self.source_folder,
                self.folders_to_include,
                self.folders_to_exclude,
                self.answer,
                self.ts,
                None,
                self.prj_loader.blocks,
                self.ext_set
            ).run()

    async def run_gradio(
        self,
        ai_service: str,
        output_file_name: str,
        messages, 
        input_prompt: str,
        source_folder: str,
        folders_to_include: List[str],
        folders_to_exclude: List[str],
        data_folder: str,
        ext_set: Set[str],
        llm: BaseChatModel,
    ):
        self.data_folder = data_folder
        self.source_folder = source_folder
        self.source_folder_len: int = len(source_folder)
        self.folders_to_include = folders_to_include
        self.folders_to_exclude = folders_to_exclude
        self.prj_loader = ProjectLoader(self.source_folder_len, ext_set, folders_to_include, folders_to_exclude, False, "")
        self.prompt = input_prompt
        self.parse_prompt = False
        self.ok_hal = ""
        self.mode = RefactorMode.REFACTOR.value
        self.ext_set = ext_set

        # default filename to timestamp if empty
        if output_file_name == "":
            output_file_name = self.ts

        # Scan the source folder for files with the specified extensions, to build up the 'blocks' dictionary
        self.prj_loader.scan_directory(self.source_folder)
        
        if self.parse_prompt: 
            if not self.prj_loader.parsed_prompt:
                raise Exception("Oops. No 'ok hal' prompt was found in the source files, or else no '?' terminator line after the prompt.")
            
            if (self.prj_loader.file_with_prompt):
                # get file extension from file_with_prompt filename
                ext = os.path.splitext(self.prj_loader.file_with_prompt)[1]
                self.prompt = self.prompt + self.get_file_type_mention(ext);

        self.prompt = self.insert_blocks_into_prompt(self.prompt)
        self.prompt = PromptUtils.insert_files_into_prompt(
            self.prompt, self.source_folder, self.prj_loader.file_names
        )
        self.prompt = PromptUtils.insert_folders_into_prompt(
            self.prompt, self.source_folder, self.folders_to_include, self.folders_to_exclude, self.ext_set
        )
        
        self.build_system_prompt("")

        tools = [
            UpdateBlockTool("Block Updater Tool", self.prj_loader.blocks),
            CreateFileTool("File Creator Tool", self.source_folder),
            UpdateFileTool("File Updater Tool", self.source_folder),
        ]
        print("Created Agent Tools")
            
        chat_prompt_template = ChatPromptTemplate.from_messages([
            SystemMessage(content=self.system_prompt),
            MessagesPlaceholder(variable_name="chat_history"),
            HumanMessagePromptTemplate.from_template("Human: {input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])
    
        # Convert messages to a format the agent can understand
        chat_history = []        
        for msg in messages:
            if msg['role'] == "user":
                chat_history.append(HumanMessage(content=msg['content']))
            elif msg['role'] == "assistant":
                chat_history.append(AIMessage(content=msg['content']))

        agent = create_openai_tools_agent(llm, tools, chat_prompt_template)
        agent_executor = AgentExecutor(agent=agent, tools=tools).with_config({"run_name": "Agent"})
        
        messages.append(ChatMessage(role="user", content=self.prompt))
        yield messages
        
        async for chunk in agent_executor.astream(
            {"input": self.prompt, "chat_history": chat_history}
        ):
            if "steps" in chunk:
                for step in chunk["steps"]:
                    messages.append(ChatMessage(role="assistant", content=step.action.log,
                                    metadata={"title": f"🛠️ Used tool {step.action.tool}"}))
                    yield messages
            if "output" in chunk:
                messages.append(ChatMessage(role="assistant", content=chunk["output"]))
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

        if self.parse_prompt and self.answer:
            self.inject_answer(self.prj_loader.file_with_prompt, self.answer, self.ok_hal)
            
        if self.mode == RefactorMode.REFACTOR.value:
            ProjectMutator(
                self.mode,
                self.source_folder,
                self.folders_to_include,
                self.folders_to_exclude,
                self.answer,
                self.ts,
                None,
                self.prj_loader.blocks,
                self.ext_set
            ).run()

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

    def parse_prompt_and_code(self, prompt: str) -> tuple[str, str]:
        """Takes the prompt and divides it at the line containing a '-' character (if there is one)
        and returns the top half as the prompt, and the bottom half as the code, otherwise the
        input prompt is sent back as prompt and code sent back as empty string
        """
        prompt_lines = prompt.split("\n")
        prompt = ""
        code = ""
        in_code = False

        for line in prompt_lines:
            if line.strip() == "-":
                in_code = True
            elif in_code:
                code += line + "\n"
            else:
                prompt += line + "\n"

        return prompt, code

    # def remove_thinking_tags(self, text: str) -> str:
    #     """Removes the thinking tags from the prompt."""
    #     # Use regex to find and remove content between <thinking> tags
    #     pattern = r'<thinking>.*?</thinking>'
    #     cleaned_text = re.sub(pattern, '', text, flags=re.DOTALL)
    #     return cleaned_text
        
    def inject_answer(self, file_with_prompt: str, answer: str, ok_hal: str):
        """Injects the AI answer into the file that contains the prompt."""
        wrote = False
        
        with FileUtils.open_file(file_with_prompt) as file:
            lines = file.readlines()
        
        with FileUtils.open_writable_file(file_with_prompt) as file:
            ready_to_write = False
            for line in lines:
                trimmed = line.strip()
                if trimmed == ok_hal:
                    ready_to_write = True
                    file.write("-"+trimmed+"\n")
                    
                elif trimmed == "?" and ready_to_write:
                    file.write(line)
                    if not wrote:
                        file.write(answer)
                        file.write("\n----\n\n")
                        wrote = True
                else:
                    file.write(line)
            print("Wrote File: "+file_with_prompt)

    def build_system_prompt(self, user_system_prompt: str):
        """Adds all the instructions to the prompt. This includes instructions for inserting blocks, files,
        folders, and creating files.

        WARNING: This method modifies the `prompt` attribute of the class to have already been configured, and
        also really everything else that this class sets up, so this method should be called last, just before
        the AI query is made.
        """

        self.system_prompt = PromptUtils.get_template(
            "../common/python/agent/prompt_templates/agent_system_prompt.txt"
        )
        self.system_prompt += AGENT_INSTRUCTIONS
        self.add_file_handling_instructions()
        self.add_block_handling_instructions()
        
        # Users themselves may have provided a system prompt so add that if so.
        if user_system_prompt:
            self.system_prompt += GENERAL_INSTRUCTIONS + user_system_prompt


    def add_block_handling_instructions(self):
        """Adds instructions for updating blocks. If the prompt contains ${BlockName} tags, then we need to provide
        instructions for how to provide the new block content."""
        if self.mode == RefactorMode.REFACTOR.value and self.prj_loader is not None and len(self.prj_loader.blocks) > 0:
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

    def insert_blocks_into_prompt(self, prompt: str) -> str:
        """
        Substitute blocks into the prompt. Prompts can contain ${BlockName} tags, which will be replaced with the
        content of the block with the name 'BlockName'

        Returns true only if someblocks were inserted.
        """
        # As performance boost, if self.prompt does not contain "block(" then return False
        if "block(" not in prompt or self.prj_loader is None or self.prj_loader.blocks is None:
            return prompt
        
        # ret = False
        for key, value in self.prj_loader.blocks.items():
            # if k in prompt:
                # ret = True

            prompt = prompt.replace(
                f"block({key})",
                f"""
{TAG_BLOCK_BEGIN} {key}
{value.content}
{TAG_BLOCK_END}
""",
            )
            
            # If no more 'block(' tags are in prompt, then we can break out of the loop
            if "block(" not in prompt:
                break
            
        return prompt
