import os
from typing import Type
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool
from common.python.utils import Utils
from ..models import FileSources

class DirectoryListingInput(BaseModel):
    folder_name: str = Field(description="Folder Name")

class DirectoryListing(BaseTool):
    name: str = "directory_listing"
    description: str = ""
    file_sources: FileSources = FileSources()
    args_schema: Type[BaseModel] = DirectoryListingInput
    return_direct: bool = False
    base_path: str = ""
    cache: bool = False

    def __init__(self, file_sources: FileSources):
        super().__init__(description="Directory Listing Tool: Gets a recursive directory listing of all files in a folder and subfolders.")
        self.file_sources = file_sources
        self.cache = False

    def _run(
        self,
        folder_name: str,
    ) -> str:
        """Use the tool."""
        ret = ""
        if folder_name == "."  or folder_name == "/" or folder_name == "./":
            folder_name = ""
            
        # if folder name starts with "." remove it.
        if folder_name.startswith("."):
            folder_name = folder_name[1:]
        
        src_folder_len: int = len(self.file_sources.source_folder)
        full_folder_name = self.file_sources.source_folder + folder_name
        # print(f"list_directory: {folder_name} (Full Path: {full_folder_name})")
         
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

