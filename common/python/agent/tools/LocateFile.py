import os
from typing import Type, List
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool
from ..models import FileSources

class LocateFileInput(BaseModel):
    filename: str = Field(description="File name without path")

class LocateFile(BaseTool):
    """We have this tool so that we can just reference files by their name, and the
    AI will be smart enough to use this tool to find where the file is, and then read it. 
    So this is just a convenience so we don't have to use the full path to the file."""
    name: str = "locate_file"
    description: str = ""
    args_schema: Type[BaseModel] = LocateFileInput
    return_direct: bool = False
    file_sources: FileSources = FileSources()
    cache: bool = False
    _file_cache: dict[str, List[str]] = {}
    _cache_built: bool = False

    def __init__(self, file_sources: FileSources):
        super().__init__(description="File Locator Tool: Finds the full path of a file by searching recursively in the source directory")
        self.file_sources = file_sources
        self.cache = False
        
    def _build_cache(self) -> None:
        """Builds a cache of filename to full paths mapping"""
        self._file_cache.clear()
        
        # todo-0: Now that we have ProjectLoader, caching all files, and keeping the cache up to date in realtime, we can
        # use that since it's all in-memory, and get rid of this file walker.
        for dirpath, _, filenames in os.walk(self.file_sources.source_folder):
            for filename in filenames:
                if filename not in self._file_cache:
                    self._file_cache[filename] = []
                full_path = os.path.join(dirpath, filename)
                self._file_cache[filename].append(full_path)
                
        self._cache_built = True

    def _run(
        self,
        filename: str,
    ) -> str:
        """Use the tool."""
        if not self._cache_built:
            self._build_cache()
            
        paths = self._file_cache.get(filename)
        if paths:
            # Return first matching path
            relative_path = paths[0][len(self.file_sources.source_folder):]
            return relative_path
        return f"ERROR: File '{filename}' not found"
