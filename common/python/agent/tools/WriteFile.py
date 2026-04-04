import os
import re
from typing import Type
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool
from ..models import FileSources
from ...file_utils import FileUtils

class WriteFileInput(BaseModel):
    file_name: str = Field(description="File Name")
    file_content: str = Field(description="File Content")

class WriteFile(BaseTool):
    name: str = "write_file"
    description: str = ""
    args_schema: Type[BaseModel] = WriteFileInput
    return_direct: bool = False
    file_sources: FileSources = FileSources()
    cache: bool = False

    def __init__(self, file_sources: FileSources):
        super().__init__(description="File Writer Tool: Writes to a file with all new content. Any paths in the file name will be created automatically if they don't exist")
        self.file_sources = file_sources
        self.cache = False
        
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
        
        # If we have VSCode opened, editing this file, it will fail to write, and we need to handle this gracefully, rather than just fail, with no reason shown
        FileUtils.write_file(full_file_name, file_content)
        msg = f"Wrote File '{file_name}'"
        print(msg)
        return msg


