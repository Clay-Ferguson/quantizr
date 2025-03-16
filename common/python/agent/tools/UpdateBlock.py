import re
from typing import Optional, Type
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool
from common.python.agent.project_loader import ProjectLoader
from ..models import FileSources, TextBlock
from ...file_utils import FileUtils
from ..tags import (
    TAG_BLOCK_BEGIN,
    TAG_BLOCK_END
)

class UpdateBlockInput(BaseModel):
    block_name: str = Field(description="Block Name")
    block_content: str = Field(description="Block Content")

class UpdateBlock(BaseTool):
    # Warning there is a reference to this block name in "block_update_instructions.txt", although things do work
    # fine even without mentioning "block_update" in those instructions.
    name: str = "update_block"
    description: str = ""
    file_sources: FileSources = FileSources()
    args_schema: Type[BaseModel] = UpdateBlockInput
    return_direct: bool = False
    cache: bool = False

    def __init__(self, file_sources: FileSources):
        super().__init__(description="Block Updater Tool: Updates a named block of text to set new content. This tool automatically knows how to find the right file to put the block in.")
        self.file_sources = file_sources
        self.cache = False

    def _run(
        self,
        block_name: str,
        block_content: str,
        # run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Use the tool."""
        print(f"UpdateBlockTool: {block_name}")
        prj_loader = ProjectLoader.get_instance(self.file_sources)
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
            msg = f"ERROR: Block not found: {block_name}"
        return msg

