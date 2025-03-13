from typing import List, Dict, Optional, Set

import os
from .models import FileSources, TextBlock
from ..utils import Utils
from .tags import TAG_BLOCK_BEGIN, TAG_BLOCK_END
from ..file_utils import FileUtils

class ProjectLoader:
    """ ProjectLoader scans all our project files and collects all information about the files and folders that we need
    """
    # Dictionary to store TextBlock objects keyed by 'name'
    blocks: Dict[str, TextBlock] = {}

    # Dictionary to store file contents keyed by 'file name'
    file_contents: Dict[str, str] = {}
    
    # All filen names encountered during the scan, relative to the source folder
    file_names: List[str] = []
    folder_names: List[str] = []

    def __init__(self, file_sources: FileSources):
        self.file_sources = file_sources     
        
    def reset(self):
        self.blocks = {}
        self.file_names = []
        self.folder_names = []

    def visit_file(self, path: str):
        """Visits a file and extracts text blocks into `blocks`. So we're just
        scanning the files for the block_begin and block_end tags, and extracting the content between them
        and saving that text for later use
        """

        # get the file name relative to the source folder
        relative_file_name: str = path[len(self.file_sources.source_folder) :]
        self.file_names.append(relative_file_name)

        # Read the file content
        content = FileUtils.read_file(path)    
        
        # put content in the file_contents dictionary
        self.file_contents[relative_file_name] = content

        # Open the file using 'with' which ensures the file is closed after reading
        with FileUtils.open_file(path) as file:
            block: Optional[TextBlock] = None

            for line in file:  # NOTE: There's no way do to typesafety in loop vars
                # Print each line; using end='' to avoid adding extra newline
                trimmed: str = line.strip()
                    
                # If this is the beginning of a block
                if Utils.is_tag_line(trimmed, TAG_BLOCK_BEGIN):
                    name: Optional[str] = Utils.parse_name_from_tag_line(
                        trimmed, TAG_BLOCK_BEGIN
                    )

                    # have we already seen this block name?
                    if name in self.blocks:
                        raise Exception(f"Duplicate Block Name `{name}` in file {path}. Block Names must be unique across all files.")
                    # if not create the block
                    else:
                        # print(f"Block name: {name}")
                        # n is a non-optional string
                        n = name if name is not None else ""
                        block = TextBlock(relative_file_name, n, "")
                        self.blocks[n] = block
                        
                # If this is the end of a block
                elif Utils.is_tag_line(trimmed, TAG_BLOCK_END):
                    if block is None:
                        raise Exception(
                            f"""Encountered {TAG_BLOCK_END} without a corresponding {TAG_BLOCK_BEGIN}""")
                    block = None
                    
                # Otherwise, we're in a block, and so we just add the line to the block
                else:
                    if block is not None:
                        block.content += line

    def strip_comment_chars(self, line: str) -> str:
        if line.startswith("// "):
            line = line[3:]
        elif line.startswith("# "):
            line = line[2:]
        elif line.startswith("* "):
            line = line[2:]
        elif line.startswith("/* "):
            line = line[3:]
        elif line.endswith(" */"):
            line = line[:-3]
        return line                            

    def find_file_containing(self, search_str: str) -> Optional[str]:
        """Finds the file containing the specified string. This is a brute force search
        and will return the first file that contains the string. If multiple files are found, it raises an error.
        Additionally, if the string is found in multiple locations within a single file, it raises an error.
        """
        found_files = []
        for file_name, content in self.file_contents.items():
            occurrences = content.count(search_str)
            if occurrences > 1:
                raise Exception(f"Multiple occurrences of `{search_str}` found in file: {file_name}")
            elif occurrences == 1:
                found_files.append(file_name)
        
        if len(found_files) == 0:
            return None
        elif len(found_files) == 1:
            return found_files[0]
        else:
            raise Exception(f"Duplicate matches for `{search_str}` found in files: {', '.join(found_files)}")

    def scan_directory(self):
        """Scans the directory for files with the specified extensions. The purpose of this scan
        is to build up the 'blocks' dictionary with the content of the blocks in the files, and also
        to collect all the filenames into `file_names`
        """
        print(f"scan_directory: {self.file_sources.source_folder}")
        self.reset()
        src_folder_len: int = len(self.file_sources.source_folder)
        
        # Walk through all directories and files in the directory
        for dirpath, _, filenames in os.walk(self.file_sources.source_folder):
            # Get the relative path of the directory, root folder is the source folder and will be "" (empty string) here
            # as the relative path of the source folder is the root folder
            short_dir: str = dirpath[src_folder_len :]

            # If not, add it to the set and list
            self.folder_names.append(short_dir)

            for filename in filenames:
                # Determine if we will include this file based on extension and folder
                includeExt = Utils.has_included_file_extension(self.file_sources.ext_set, filename)
                includeFolder = Utils.allow_folder(self.file_sources.folders_to_include, self.file_sources.folders_to_exclude, short_dir)
                
                if (includeExt and includeFolder):
                    # print(f"include file {filename} in {dirpath}")
                    # build the full path
                    path: str = os.path.join(dirpath, filename)
                    # Call the visitor function for each file
                    self.visit_file(path)
                # else:
                #    print(f"Skipping file {filename} in {dirpath}")
        
        # print number of blocks we ended up with
        print(f"Found {len(self.blocks)} blocks")
