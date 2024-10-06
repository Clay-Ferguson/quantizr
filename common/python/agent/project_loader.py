from typing import List, Dict, Optional, Set

import os
from .models import TextBlock
from ..utils import Utils
from .tags import TAG_BLOCK_BEGIN, TAG_BLOCK_END, TAG_BLOCK_OFF, TAG_BLOCK_ON
from ..file_utils import FileUtils


class ProjectLoader:
    # Dictionary to store TextBlock objects keyed by 'name'
    blocks: Dict[str, TextBlock] = {}
    # All filen names encountered during the scan, relative to the source folder
    file_names: List[str] = []
    folder_names: List[str] = []
    folders_to_include: List[str] = []
    folders_to_exclude: List[str] = []
    parse_prompt: bool = False
    parsed_prompt: str = ""
    file_with_prompt: str = ""

    # folders_to_include is a newline (\n) separated list of folders to include in the scan
    def __init__(self, source_folder_len: int, ext_set: Set[str], folders_to_include: List[str], folders_to_exclude: List[str], parse_prompt: bool = False, ok_hal: str = ""):
        self.source_folder_len = source_folder_len
        self.ext_set = ext_set
        self.folders_to_include = folders_to_include
        self.folders_to_exclude = folders_to_exclude
        self.parse_prompt = parse_prompt
        self.parsed_prompt = ""
        self.file_with_prompt = ""
        self.ok_hal = ok_hal
        
        
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
        relative_file_name: str = path[self.source_folder_len :]
        self.file_names.append(relative_file_name)

        # Open the file using 'with' which ensures the file is closed after reading
        with FileUtils.open_file(path) as file:
            block: Optional[TextBlock] = None
            block_on: bool = True
            in_prompt: bool = False
            parsed_prompt: str = ""

            for line in file:  # NOTE: There's no way do to typesafety in loop vars
                # Print each line; using end='' to avoid adding extra newline
                trimmed: str = line.strip()

                # If we're parsing the prompt
                if in_prompt:
                    if trimmed == "?":
                        self.parsed_prompt = parsed_prompt
                        self.file_with_prompt = path
                        in_prompt = False
                    else:  
                        prompt_line = self.strip_comment_chars(trimmed)
                        parsed_prompt += prompt_line+"\n"

                if trimmed == self.ok_hal and self.parse_prompt and not self.parsed_prompt:
                    in_prompt = True
                    
                elif Utils.is_tag_line(trimmed, TAG_BLOCK_BEGIN):
                    name: Optional[str] = Utils.parse_name_from_tag_line(
                        trimmed, TAG_BLOCK_BEGIN
                    )

                    if name in self.blocks:
                        raise Exception(f"Duplicate Block Name `{name}` in file {path}. Block Names must be unique across all files.")
                    else:
                        # n is a non-optional string
                        n = name if name is not None else ""
                        block = TextBlock(relative_file_name, n, "", False)
                        self.blocks[n] = block
                        
                elif Utils.is_tag_line(trimmed, TAG_BLOCK_END):
                    if block is None:
                        raise Exception(
                            f"""Encountered {TAG_BLOCK_END} without a corresponding {TAG_BLOCK_BEGIN}""")
                    block = None
                    
                elif Utils.is_tag_line(trimmed, TAG_BLOCK_OFF):
                    if block is not None:
                        block.updateable = False
                        block_on = False
                        
                elif Utils.is_tag_line(trimmed, TAG_BLOCK_ON):
                    if block is not None:
                        block_on = True
                        
                else:
                    if block is not None and block_on:
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

    def scan_directory(self, scan_dir: str):
        """Scans the directory for files with the specified extensions. The purpose of this scan
        is to build up the 'blocks' dictionary with the content of the blocks in the files, and also
        to collect all the filenames into `file_names`
        """
        print("scan_directory: "+ scan_dir)
        self.reset()
        # Walk through all directories and files in the directory
        for dirpath, _, filenames in os.walk(scan_dir):
            # Get the relative path of the directory, root folder is the source folder and will be "" (empty string) here
            # as the relative path of the source folder is the root folder
            short_dir: str = dirpath[self.source_folder_len :]

            # If not, add it to the set and list
            self.folder_names.append(short_dir)

            for filename in filenames:
                if (Utils.has_included_file_extension(self.ext_set, filename) and 
                    Utils.has_included_folder(self.folders_to_include, short_dir) and
                    not Utils.has_included_folder(self.folders_to_exclude, short_dir)):
                    # print(f"visit file {filename} in {dirpath}")
                    # build the full path
                    path: str = os.path.join(dirpath, filename)
                    # Call the visitor function for each file
                    self.visit_file(path)
                #else:
                #    print(f"Skipping file {filename} in {dirpath}")
