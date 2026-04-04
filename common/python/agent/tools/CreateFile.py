import os
from typing import Type
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool
from ..models import FileSources
from ...file_utils import FileUtils

class CreateFileInput(BaseModel):
    file_name: str = Field(description="File Name")
    file_content: str = Field(description="File Content")

class CreateFile(BaseTool):
    name: str = "create_file"
    description: str = ""
    args_schema: Type[BaseModel] = CreateFileInput
    return_direct: bool = False
    file_sources: FileSources = FileSources()
    cache: bool = False

    def __init__(self, file_sources: FileSources):
        super().__init__(description="File Creator Tool: Creates a new file with the specified content. Subfolders will be created automatically if they don't exist.")
        self.file_sources = file_sources
        self.cache = False

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

