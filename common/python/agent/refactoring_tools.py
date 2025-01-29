"""Tools for updating files, creating new files, or updating blocks of text."""

import os
from typing import Dict, Optional, Type
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool
from .models import TextBlock
from ..file_utils import FileUtils

class UpdateBlockInput(BaseModel):
    block_name: str = Field(description="Block Name")
    block_content: str = Field(description="Block Content")

class CreateFileInput(BaseModel):
    file_name: str = Field(description="File Name")
    file_content: str = Field(description="File Content")


class UpdateFileInput(BaseModel):
    file_name: str = Field(description="File Name")
    file_content: str = Field(description="File Content")

class UpdateBlockTool(BaseTool):
    """Tool for updating named blocks of text to set new content"""

    # Warning there is a reference to this block name in "block_update_instructions.txt", although things do work
    # fine even without mentioning "block_update" in those instructions.
    name: str = "update_block"
    description: str = "useful for when you need to update named blocks of text to set new content"
    
    args_schema: Type[BaseModel] = UpdateBlockInput
    return_direct: bool = False
    blocks: Dict[str, TextBlock] = {}

    def __init__(self, description, blocks):
        super().__init__(description=description)
        self.blocks = blocks
        print(f"Created UpdateBlockTool with {len(blocks)} blocks")

    def _run(
        self,
        block_name: str,
        block_content: str,
        # run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Use the tool."""
        print(f"UpdateBlockTool: {block_name}")
        msg = f"Tool Updated Block: {block_name} with content: {block_content}"
        block: Optional[TextBlock] = self.blocks.get(block_name)
        if block is not None:            
            block.content = block_content
            block.dirty = True
        else:
            print(f"Warning: Block not found: {block_name}")
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
