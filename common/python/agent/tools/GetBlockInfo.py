import os
import re
from typing import Optional, Type
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool
from common.python.agent.project_loader import ProjectLoader
from ..models import FileSources, TextBlock

class GetBlockInfoInput(BaseModel):
    block_name: str = Field(description="Block Name")

class GetBlockInfo(BaseTool):
    name: str = "get_block_info"
    description: str = ""
    file_sources: FileSources = FileSources()
    args_schema: Type[BaseModel] = GetBlockInfoInput
    return_direct: bool = False
    cache: bool = False

    def __init__(self, file_sources: FileSources):
        super().__init__(description="Get Block Info Tool: Retrieves information about a named text block, including its location and complete content. Returns both the file path where the block is defined and the block's current content.")
        self.file_sources = file_sources
        self.cache = False

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
            msg = f"ERROR: Block '{block_name}' not found"
        return msg
