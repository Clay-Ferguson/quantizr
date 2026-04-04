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

    def __eq__(self, other):
        if not isinstance(other, FileSources):
            return False
        
        # Compare all relevant attributes
        return (
            self.source_folder == other.source_folder and
            self.ext_set == other.ext_set and
            self.folders_to_include == other.folders_to_include and 
            self.folders_to_exclude == other.folders_to_exclude
        )
    
    # Optional but recommended when implementing __eq__
    def __hash__(self):
        # Create a hash based on the immutable parts of the object
        return hash((
            self.source_folder,
            frozenset(self.ext_set) if hasattr(self.ext_set, '__iter__') else self.ext_set,
            frozenset(self.folders_to_include) if hasattr(self.folders_to_include, '__iter__') else self.folders_to_include,
            frozenset(self.folders_to_exclude) if hasattr(self.folders_to_exclude, '__iter__') else self.folders_to_exclude
        ))