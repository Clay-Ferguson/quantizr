"""Tools for updating files, creating new files, or updating blocks of text."""

import os
import re
from typing import Dict, Optional, Type, List, Set
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool

from common.python.agent.project_loader import ProjectLoader
from common.python.utils import Utils
from .models import TextBlock
from ..file_utils import FileUtils

from .tags import (
    TAG_BLOCK_BEGIN,
    TAG_BLOCK_END
)

# todo-0: for all these tools, especially 'get_block_info' I want to add a lot more info on how to use them.

class GetBlockInfoInput(BaseModel):
    block_name: str = Field(description="Block Name")

class UpdateBlockInput(BaseModel):
    block_name: str = Field(description="Block Name")
    block_content: str = Field(description="Block Content")

class CreateFileInput(BaseModel):
    file_name: str = Field(description="File Name")
    file_content: str = Field(description="File Content")

class DirectoryListingInput(BaseModel):
    folder_name: str = Field(description="Folder Name")

class UpdateFileInput(BaseModel):
    file_name: str = Field(description="File Name")
    file_content: str = Field(description="File Content")

class ReadFileInput(BaseModel):
    file_name: str = Field(description="File Name")

class GetBlockInfoTool(BaseTool):
    """Tool for getting information about named blocks of text, including the entire current block content, and what file the block is defined in."""

    # Warning there is a reference to this block name in "block_update_instructions.txt", although things do work
    # fine even without mentioning "block_update" in those instructions.
    name: str = "get_block_info"
    description: str = "useful for when you need to get information about a named block of text, including the entire current block content, and what file the block is defined in."
    source_folder: str = ""
    folders_to_include: List[str] = []
    folders_to_exclude: List[str] = []
    ext_set: Set[str] = set()
    
    args_schema: Type[BaseModel] = GetBlockInfoInput
    return_direct: bool = False

    def __init__(self, description, source_folder: str, folders_to_include: List[str], folders_to_exclude: List[str], ext_set: Set[str]):
        super().__init__(description=description)
        # self.blocks = blocks
        self.source_folder = source_folder
        self.folders_to_include = folders_to_include
        self.folders_to_exclude = folders_to_exclude
        self.ext_set = ext_set
        print(f"Created GetBlockInfoTool")

    def _run(
        self,
        block_name: str,
        # run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Use the tool."""
        print(f"GetBlockInfoTool: {block_name}")
        prj_loader = ProjectLoader(self.source_folder, self.ext_set, self.folders_to_include, self.folders_to_exclude)
        prj_loader.scan_directory(self.source_folder)
        
        block: Optional[TextBlock] = prj_loader.blocks.get(block_name)
        if block is not None:            
            msg = f"Block {block_name} is defined in file {prj_loader.blocks[block_name].rel_filename}. The current block content is between the block_content tags here:\n <block_content>{block.content}</block_content>"
        else:
            # todo-0: I think throwing an exception here, instead is the better way to let the agent know we hit a problem right?
            msg = f"Warning: Block not found: {block_name}"
        return msg

class UpdateBlockTool(BaseTool):
    """Tool for updating a named block of text to set new content"""

    # Warning there is a reference to this block name in "block_update_instructions.txt", although things do work
    # fine even without mentioning "block_update" in those instructions.
    name: str = "update_block"
    description: str = "useful for when you need to updat a named block of text to set new content"
    source_folder: str = ""
    folders_to_include: List[str] = []
    folders_to_exclude: List[str] = []
    ext_set: Set[str] = set()
    
    args_schema: Type[BaseModel] = UpdateBlockInput
    return_direct: bool = False

    def __init__(self, description, source_folder: str, folders_to_include: List[str], folders_to_exclude: List[str], ext_set: Set[str]):
        super().__init__(description=description)
        # self.blocks = blocks
        self.source_folder = source_folder
        self.folders_to_include = folders_to_include
        self.folders_to_exclude = folders_to_exclude
        self.ext_set = ext_set
        print(f"Created UpdateBlockTool")

    def _run(
        self,
        block_name: str,
        block_content: str,
        # run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Use the tool."""
        print(f"UpdateBlockTool: {block_name}")
        prj_loader = ProjectLoader(self.source_folder, self.ext_set, self.folders_to_include, self.folders_to_exclude)
        prj_loader.scan_directory(self.source_folder)
        
        block: Optional[TextBlock] = prj_loader.blocks.get(block_name)
        if block is not None:            
            if block.rel_filename is None:
                return "Warning: Block filename is None"
            
            full_file_name = self.source_folder + block.rel_filename
            content = FileUtils.read_file(full_file_name)
            
            if f"{TAG_BLOCK_BEGIN} {block_name}" not in content:
                return "Warning: Block not found: {block_name}"

            found: bool = False
            lines = content.splitlines()
            new_lines = []
            in_block = False
            comment_pattern = r"(//|--|#)"

            for line in lines:
                trimmed = line.strip()
                if in_block:
                    if re.match(rf"{comment_pattern} {TAG_BLOCK_END}$", trimmed):
                        in_block = False
                        new_lines.append(block_content)
                        new_lines.append(line)
                        found = True
                elif re.match(rf"{comment_pattern} {TAG_BLOCK_BEGIN} {block_name}$", trimmed):
                    in_block = True
                    new_lines.append(line)
                else:
                    new_lines.append(line)

            if found:
                content = "\n".join(new_lines)
                # write the file
                FileUtils.write_file(full_file_name, content)
                msg = f"Tool Updated Block {block_name} by updating it in file {prj_loader.blocks[block_name].rel_filename}"
            
        else:
            # todo-0: I think throwing an exception here, instead is the better way to let the agent know we hit a problem right?
            msg = f"Warning: Block not found: {block_name}"
        return msg

    # This async stuff is optional and performance related, so for now we omit.
    # async def _arun(
    #     self,
    #     block_name: str, block_content: str,
    #     run_manager: Optional[AsyncCallbackManagerForToolRun] = None,
    # ) -> str:
    #     """Use the tool asynchronously."""
    #     # If the calculation is cheap, you can just delegate to the sync implementation
    #     # as shown below.
    #     # If the sync calculation is expensive, you should delete the entire _arun method.
    #     # LangChain will automatically provide a better implementation that will
    #     # kick off the task in a thread to make sure it doesn't block other async code.
    #     return self._run(block_name, block_content, run_manager=run_manager.get_sync())

# todo-0: add note to agent that tells it, it can use this and expect subfolders to be created automatically. Ask AI how to do this
# in a way that's tool internal (not part of System Prompt). Is it just added to description?
class CreateFileTool(BaseTool):
    """Tool to create a new file."""

    name: str = "create_file"
    description: str = "useful for when you need to create a new file"
    
    args_schema: Type[BaseModel] = CreateFileInput
    return_direct: bool = False
    base_path: str = ""

    def __init__(self, description, base_path: str):
        super().__init__(description=description)
        self.base_path = base_path

    def _run(
        self,
        file_name: str,
        file_content: str,
    ) -> str:
        """Use the tool."""
        msg = f"File Created: {file_name} with content: {file_content}"
        print(f"File Created: {file_name}")

        if not file_name.startswith("/"):
            file_name = "/" + file_name
        full_file_name = self.base_path + file_name

        # if the file already exists print a warning message
        if os.path.isfile(full_file_name):
            # TODO: Need to investigate how the LLM and our GUI should report failures in tools to the user
            print(f"Warning: File already exists: {full_file_name}")
            # st.error(f"Error: File already exists: {full_file_name}")
        else:
            # ensure that folder 'self.base_path' exists
            FileUtils.ensure_folder_exists(full_file_name)
            # write the content to a file only if the file currently does not exist
            FileUtils.write_file(full_file_name, file_content)
        return msg

class DirectoryListingTool(BaseTool):
    """Tool to get a listing of folders (filtered by the config settings)."""

    name: str = "directory_listing"
    description: str = "Useful for when you need to get a directory listing of folders"
    source_folder: str = ""
    folders_to_include: List[str] = []
    folders_to_exclude: List[str] = []
    ext_set: Set[str] = set()
    
    args_schema: Type[BaseModel] = DirectoryListingInput
    return_direct: bool = False
    base_path: str = ""

    # todo-0: for this and all tools, remove 'description' from being a constructor arg, and make it internal
    def __init__(self, description, source_folder: str, folders_to_include: List[str], folders_to_exclude: List[str], ext_set: Set[str]):
        super().__init__(description=description)
        self.source_folder = source_folder
        self.folders_to_include = folders_to_include
        self.folders_to_exclude = folders_to_exclude
        self.ext_set = ext_set

    def _run(
        self,
        folder_name: str,
    ) -> str:
        """Use the tool."""
        ret = ""
        if folder_name == ".":
            folder_name = "/"
            
        # if folder name starts with "." remove it.
        if folder_name.startswith("."):
            folder_name = folder_name[1:]
        
        print(f"list_directory: {folder_name}")
        src_folder_len: int = len(self.source_folder)
        full_folder_name = self.source_folder + folder_name
         
        # Walk through all directories and files in the directory
        for dirpath, _, filenames in os.walk(full_folder_name):
            # Get the relative path of the directory, root folder is the source folder and will be "" (empty string) here
            # as the relative path of the source folder is the root folder
            short_dir: str = dirpath[src_folder_len :]

            for filename in filenames:
                # Determine if we will include this file based on extension and folder
                includeExt = Utils.has_included_file_extension(self.ext_set, filename)
                includeFolder = Utils.allow_folder(self.folders_to_include, self.folders_to_exclude, short_dir)
                
                if (includeExt and includeFolder):
                    # print(f"include file {filename} in {dirpath}")
                    # build the full path
                    path: str = os.path.join(dirpath, filename)
                    short_name: str = path[src_folder_len:]
                    ret += short_name + "\n"
                # else:
                #    print(f"Skipping file {filename} in {dirpath}")

        return ret

class ReadFileTool(BaseTool):
    """Tool to read a file."""

    name: str = "read_file"
    description: str = "useful for when you need to read an existing file and get its text content"
    
    args_schema: Type[BaseModel] = ReadFileInput
    return_direct: bool = False
    base_path: str = ""

    def __init__(self, description, base_path: str):
        super().__init__(description=description)
        self.base_path = base_path

    def _run(
        self,
        file_name: str,
    ) -> str:
        """Use the tool."""
        print(f"Reading file: {file_name}")
        if not file_name.startswith("/"):
            file_name = "/" + file_name
        full_file_name = self.base_path + file_name
        content = FileUtils.read_file(full_file_name)
        print("    File content: " + content)
        return content

# todo-0: rename this (and associated documentation) to "WriteFileTool"
class UpdateFileTool(BaseTool):
    """Tool to update a file by writing all new content to the file"""

    name: str = "update_file"
    description: str = "useful for when you need to update an existing file with all new content"
    
    args_schema: Type[BaseModel] = UpdateFileInput
    return_direct: bool = False
    base_path: str = ""

    def __init__(self, description, base_path: str):
        super().__init__(description=description)
        self.base_path = base_path

    def _run(
        self,
        file_name: str,
        file_content: str,
    ) -> str:
        """Use the tool."""
        msg = f"File Updated: {file_name} with content: {file_content}"
        print(f"File Updated: {file_name}")
        if not file_name.startswith("/"):
            file_name = "/" + file_name
        full_file_name = self.base_path + file_name
        FileUtils.write_file(full_file_name, file_content)

        return msg
