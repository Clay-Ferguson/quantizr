"""Tools for updating files, creating new files, or updating blocks of text."""

import os
import re
from typing import Optional, Type, List
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool

from common.python.agent.project_loader import ProjectLoader
from common.python.utils import Utils
from .models import FileSources, TextBlock
from ..file_utils import FileUtils

from .tags import (
    TAG_BLOCK_BEGIN,
    TAG_BLOCK_END
)

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

class WriteFileInput(BaseModel):
    file_name: str = Field(description="File Name")
    file_content: str = Field(description="File Content")

class ReadFileInput(BaseModel):
    file_name: str = Field(description="File Name")

class GetBlockInfoTool(BaseTool):
    # Warning there is a reference to this block name in "block_update_instructions.txt", although things do work
    # fine even without mentioning "block_update" in those instructions.
    name: str = "get_block_info"
    description: str = ""
    file_sources: FileSources = FileSources()
    
    args_schema: Type[BaseModel] = GetBlockInfoInput
    return_direct: bool = False

    def __init__(self, file_sources: FileSources):
        super().__init__(description="Get Block Info Tool: Retrieves information about a named text block, including its location and complete content. Returns both the file path where the block is defined and the block's current content.")
        self.file_sources = file_sources

    def _run(
        self,
        block_name: str,
        # run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Use the tool."""
        print(f"GetBlockInfoTool: {block_name}")
        prj_loader = ProjectLoader(self.file_sources)
        prj_loader.scan_directory()
        
        block: Optional[TextBlock] = prj_loader.blocks.get(block_name)
        if block is not None:            
            msg = f"Block '{block_name}' is defined in file '{prj_loader.blocks[block_name].rel_filename}'. Current block content: <block_content>{block.content}</block_content>"
        else:
            # todo-0: I think throwing an exception here, instead is the better way to let the agent know we hit a problem right?
            msg = f"ERROR: Block '{block_name}' not found"
        return msg

class UpdateBlockTool(BaseTool):
    # Warning there is a reference to this block name in "block_update_instructions.txt", although things do work
    # fine even without mentioning "block_update" in those instructions.
    name: str = "update_block"
    description: str = ""
    file_sources: FileSources = FileSources()
    
    args_schema: Type[BaseModel] = UpdateBlockInput
    return_direct: bool = False

    def __init__(self, file_sources: FileSources):
        super().__init__(description="Block Updater Tool: Updates a named block of text to set new content. This tool automatically knows how to find the right file to put the block in.")
        self.file_sources = file_sources

    def _run(
        self,
        block_name: str,
        block_content: str,
        # run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Use the tool."""
        print(f"UpdateBlockTool: {block_name}")
        prj_loader = ProjectLoader(self.file_sources)
        prj_loader.scan_directory()
        
        block: Optional[TextBlock] = prj_loader.blocks.get(block_name)
        if block is not None:            
            if block.rel_filename is None:
                return "Warning: Block filename is None"
            
            full_file_name = self.file_sources.source_folder + block.rel_filename
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
                msg = f"SUCCESS: Block '{block_name}' updated in file '{prj_loader.blocks[block_name].rel_filename}'"
            
        else:
            # todo-0: I think throwing an exception here, instead is the better way to let the agent know we hit a problem right?
            msg = f"ERROR: Block not found: {block_name}"
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

class CreateFileTool(BaseTool):
    name: str = "create_file"
    description: str = ""
    
    args_schema: Type[BaseModel] = CreateFileInput
    return_direct: bool = False
    file_sources: FileSources = FileSources()

    def __init__(self, file_sources: FileSources):
        super().__init__(description="File Creator Tool: Creates a new file with the specified content. Subfolders will be created automatically if they don't exist.")
        self.file_sources = file_sources

    def _run(
        self,
        file_name: str,
        file_content: str,
    ) -> str:
        """Use the tool."""
        msg = f"File Created with name '{file_name}' and content: <content>{file_content}</content>"
        print(f"File Created: {file_name}")

        if not file_name.startswith("/"):
            file_name = "/" + file_name
        full_file_name = self.file_sources.source_folder + file_name

        # if the file already exists print a warning message
        if os.path.isfile(full_file_name):
            # TODO: Need to investigate how the LLM and our GUI should report failures in tools to the user
            print(f"Warning: File '{full_file_name}' already exisits.")
            # st.error(f"Error: File already exists: {full_file_name}")
        else:
            # ensure that folder 'self.base_path' exists
            FileUtils.ensure_folder_exists(full_file_name)
            # write the content to a file only if the file currently does not exist
            FileUtils.write_file(full_file_name, file_content)
        return msg

class DirectoryListingTool(BaseTool):
    name: str = "directory_listing"
    description: str = ""
    file_sources: FileSources = FileSources()
    
    args_schema: Type[BaseModel] = DirectoryListingInput
    return_direct: bool = False
    base_path: str = ""

    def __init__(self, file_sources: FileSources):
        super().__init__(description="Directory Listing Tool: Gets a recursive directory listing of all files in a folder and subfolders.")
        self.file_sources = file_sources

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
        src_folder_len: int = len(self.file_sources.source_folder)
        full_folder_name = self.file_sources.source_folder + folder_name
         
        # Walk through all directories and files in the directory
        for dirpath, _, filenames in os.walk(full_folder_name):
            # Get the relative path of the directory, root folder is the source folder and will be "" (empty string) here
            # as the relative path of the source folder is the root folder
            short_dir: str = dirpath[src_folder_len :]

            for filename in filenames:
                # Determine if we will include this file based on extension and folder
                includeExt = Utils.has_included_file_extension(self.file_sources.ext_set, filename)
                includeFolder = Utils.allow_folder(self.file_sources.folders_to_include, self.file_sources.folders_to_exclude, short_dir)
                
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
    name: str = "read_file"
    description: str = ""
    args_schema: Type[BaseModel] = ReadFileInput
    return_direct: bool = False
    file_sources: FileSources = FileSources()

    def __init__(self, file_sources: FileSources):
        super().__init__(description="File Reader Tool: Reads an existing file to get its text content")
        self.file_sources = file_sources

    def _run(
        self,
        file_name: str,
    ) -> str:
        """Use the tool."""
        print(f"Reading file: {file_name}")
        if not file_name.startswith("/"):
            file_name = "/" + file_name
        full_file_name = self.file_sources.source_folder + file_name
        content = FileUtils.read_file(full_file_name)
        print("    File content: " + content)
        return content

class WriteFileTool(BaseTool):
    name: str = "write_file"
    description: str = ""
    args_schema: Type[BaseModel] = WriteFileInput
    return_direct: bool = False
    file_sources: FileSources = FileSources()

    def __init__(self, file_sources: FileSources):
        super().__init__(description="File Writer Tool: Writes to a file with all new content. Any paths in the file name will be created automatically if they don't exist")
        self.file_sources = file_sources
        
    def _run(
        self,
        file_name: str,
        file_content: str,
    ) -> str:
        """Use the tool."""
        if not file_name.startswith("/"):
            file_name = "/" + file_name
        full_file_name = self.file_sources.source_folder + file_name
        
        # ensure that all paths exist for the file
        FileUtils.ensure_folder_exists(full_file_name)
        
        FileUtils.write_file(full_file_name, file_content)
        msg = f"Wrote File '{file_name}'"
        print(msg)
        return msg

@staticmethod
def init_tools(file_sources: FileSources) -> List[BaseTool]:
    """Initialize tools for the agent."""
    return [
        GetBlockInfoTool(file_sources),
        UpdateBlockTool(file_sources),
        CreateFileTool(file_sources),
        DirectoryListingTool(file_sources),
        ReadFileTool(file_sources),
        WriteFileTool(file_sources)
    ]
    
    