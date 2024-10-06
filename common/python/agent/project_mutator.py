"""Injects data into files."""

import os
import re
from typing import List, Dict, Optional, Set
from .models import TextBlock
from ..string_utils import StringUtils
from .tags import (
    TAG_BLOCK_BEGIN,
    TAG_BLOCK_END,
    TAG_FILE_BEGIN,
    TAG_FILE_END,
)
from ..utils import RefactorMode, Utils
from ..file_utils import FileUtils

class ProjectMutator:
    """Performs all project mutations that the AI has requested."""

    blocks: Dict[str, TextBlock] = {}
    folders_to_include: List[str] = []
    folders_to_exclude: List[str] = []

    def __init__(
        self,
        mode: str,
        source_folder: str,
        folders_to_include: List[str],
        folders_to_exclude: List[str],
        ai_answer: str,
        ts: str,
        suffix: Optional[str],
        blocks: Dict[str, TextBlock],
        ext_set: Set[str],
    ):
        """Initializes the ProjectMutator object."""
        self.mode: str = mode
        self.source_folder: str = source_folder
        self.source_folder_len: int = len(source_folder)
        self.ai_answer: str = ai_answer
        self.suffix: Optional[str] = suffix
        self.ts: str = ts
        self.blocks = blocks
        self.ext_set = ext_set
        self.folders_to_include = folders_to_include
        self.folders_to_exclude = folders_to_exclude

    def run(self):
        """Performs all the project mutations which may be new files, updated files, or updated blocks in files."""

        self.process_project()


    def visit_file(self, filename: str):
        """Visit the file, to run all code modifications on the file"""

        # we need content to be mutable in the methods we pass it to so we hold in a dict
        content: List[str] = [""]
        try:
            # Read the entire file content
            content[0] = FileUtils.read_file(filename)
            modified: bool = False

            # Check if we have a diff for this file
            rel_filename: str = filename[self.source_folder_len :]
            new_content: Optional[str] = None

            if self.mode == RefactorMode.REFACTOR.value:
                new_content = self.parse_modified_file(self.ai_answer, rel_filename)

            if new_content is not None:
                content[0] = new_content
                modified = True
            # else if no new content, so we try any block updates
            else:
                if self.mode == RefactorMode.REFACTOR.value:
                    for name, block in self.blocks.items():
                        if block.dirty:
                            if self.replace_block(content, block, name):
                                modified = True

            if modified:
                print(f"Updated File: {filename}")

            # Write the modified content back to the file
            if modified:
                out_file: str = (
                    StringUtils.add_filename_suffix(filename, self.suffix)
                    if self.suffix
                    else filename
                )
                FileUtils.write_file(out_file, content[0])

        except FileNotFoundError:
            print(f"The file {filename} does not exist.")
        except IOError:
            print("An error occurred while reading or writing to the file.")

    def parse_modified_file(self, ai_answer: str, rel_filename: str) -> Optional[str]:
        """Extract the new content for the given file from the AI answer."""

        if f"""{TAG_FILE_BEGIN} {rel_filename}""" not in ai_answer:
            return None

        # Scan all the lines in content one by one and extract the new content
        new_content: List[str] = []
        started: bool = False

        for line in ai_answer.splitlines():
            if started:
                if Utils.is_tag_and_name_line(line, TAG_FILE_END, rel_filename):
                    started = False
                    break
                new_content.append(line)
            elif Utils.is_tag_and_name_line(line, TAG_FILE_BEGIN, rel_filename):
                if len(new_content) > 0:
                    raise Exception(
                        f"Error: {TAG_FILE_BEGIN} {rel_filename} exists multiple times in ai response. The LLM itself is failing.",)
                started = True

        if len(new_content) == 0:
            return None

        ret: str = "\n".join(new_content)
        return ret

    def replace_block(self, content: List[str], block: TextBlock, name: str) -> bool:
        """Process the replacement for the given block. This is what does the actual
        replacement of a named block of code in the file

        We replace the first element of the dict content with the new content, so we're treating 'content'
        as a mutable object.
        """

        if f"{TAG_BLOCK_BEGIN} {name}" not in content[0]:
            return False

        found: bool = False
        lines = content[0].splitlines()
        new_lines = []
        in_block = False
        comment_pattern = r"(//|--|#)"

        for line in lines:
            trimmed = line.strip()
            if in_block:
                if re.match(rf"{comment_pattern} {TAG_BLOCK_END}$", trimmed):
                    in_block = False
                    new_lines.append(block.content)
                    new_lines.append(line)
                    found = True
            elif re.match(rf"{comment_pattern} {TAG_BLOCK_BEGIN} {name}$", trimmed):
                in_block = True
                new_lines.append(line)
            else:
                new_lines.append(line)

        if found:
            content[0] = "\n".join(new_lines)

        return found

    def process_project(self):
        """Scans the directory for files with the specified extensions."""

        # Walk through all directories and files in the directory
        for dirpath, _, filenames in os.walk(self.source_folder):
            for filename in filenames:
                short_dir: str = dirpath[self.source_folder_len :]
                 
                # Check the file extension
                if (Utils.has_included_file_extension(self.ext_set, filename) 
                    and Utils.has_included_folder(self.folders_to_include, short_dir) 
                    and not Utils.has_included_folder(self.folders_to_exclude, short_dir)):
                    # build the full path
                    path: str = os.path.join(dirpath, filename)
                    # Call the visitor function for each file
                    self.visit_file(path)
