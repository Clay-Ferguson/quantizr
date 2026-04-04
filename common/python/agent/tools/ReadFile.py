from typing import Type
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool
from ..models import FileSources
from ...file_utils import FileUtils

class ReadFileInput(BaseModel):
    file_name: str = Field(description="File Name")

class ReadFile(BaseTool):
    name: str = "read_file"
    description: str = ""
    args_schema: Type[BaseModel] = ReadFileInput
    return_direct: bool = False
    file_sources: FileSources = FileSources()
    cache: bool = False
    
    def __init__(self, file_sources: FileSources):
        super().__init__(description="File Reader Tool: Reads an existing file to get its text content")
        self.file_sources = file_sources
        self.cache = False

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

