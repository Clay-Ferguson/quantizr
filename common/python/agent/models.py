from dataclasses import dataclass
from typing import List, Optional, Set

from pydantic import BaseModel


@dataclass
class TextBlock:
    """Represents a block of text in a file."""

    rel_filename: Optional[str]
    name: str
    content: str

    #constructor function
    def __init__(self, rel_filename: Optional[str], name: str, content: str):
        self.rel_filename = rel_filename
        self.name = name
        self.content = content
        
@dataclass
class FileSources:
    """Encapsulates path names and file extensions that make up the agent input files."""

    source_folder: str
    prompts_folder: str
    folders_to_include: List[str]
    folders_to_exclude: List[str]
    ext_set: Set[str]
    data_folder: str
    
    #constructor function
    def __init__(self, prompts_folder: str="", source_folder :str = "", folders_to_include: List[str] = [], folders_to_exclude: List[str] = [], ext_set: Set[str] = set(), data_folder: str = ""):
        self.prompts_folder = prompts_folder
        self.source_folder = source_folder
        self.folders_to_include = folders_to_include
        self.folders_to_exclude = folders_to_exclude
        self.ext_set = ext_set
        self.data_folder = data_folder