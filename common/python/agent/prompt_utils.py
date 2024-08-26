"""Contains the prompt templates for the agent."""

import os
import re
from typing import List, Optional, Dict, Tuple, Set
from langchain.prompts import PromptTemplate
from ..string_utils import StringUtils
from .tags import (
    TAG_FILE_BEGIN,
    TAG_FILE_END,
    template_info,
)
from ..utils import Utils
from ..file_utils import FileUtils


class PromptUtils:
    """Contains the prompt templates for the agent."""

    tplt_file_content_block: Optional[PromptTemplate] = None

    # caches the version of a template file, after core substitutions have been made from template_info
    template_cache: Dict[str, str] = {}

    @staticmethod
    def get_template(file_name: str) -> str:
        """
        Get the template for the given file name.
        NOTE: Of the file_name contains a slash we use it as is (minus the .txt extension),
        else we assume it's in prompt_templates folder
        """
        if file_name not in PromptUtils.template_cache:
            pt = PromptTemplate.from_file(file_name)
            PromptUtils.template_cache[file_name] = (
                "\n\n" + StringUtils.post_process_template(pt.format(**template_info))
            )

        return PromptUtils.template_cache[file_name]

    @staticmethod
    def get_file_content_block(file_name: str, content: str) -> str:
        """Get the content block for a file."""
        return f"""
{TAG_FILE_BEGIN} {file_name}
{content}
{TAG_FILE_END} {file_name}
"""

    @staticmethod
    def build_folder_content(folder_path: str, source_folder_len: int, ext_set: Set[str]) -> str:
        """Builds the content of a folder. Which will contain all the filenames and their content."""
        print(f"Building content for folder: {folder_path}")

        content = f"""

Below is the content of the files in the folder named {folder_path} (using {TAG_FILE_BEGIN} and {TAG_FILE_END} tags to delimit the files):
        """
        for dirpath, _, filenames in os.walk(folder_path):
            for filename in filenames:
                # Check the file extension
                if Utils.should_include_file(ext_set, filename):
                    # build the full path
                    path: str = os.path.join(dirpath, filename)
                    # get the file name relative to the source folder
                    file_name: str = path[source_folder_len:]
                    file_content = FileUtils.read_file(path)
                    content += PromptUtils.get_file_content_block(
                        file_name, file_content
                    )

        return content

    @staticmethod
    def insert_files_into_prompt(
        prompt: str, source_folder: str, file_names: List[str]
    ) -> str:
        """
        Substitute entire file contents into the prompt. Prompts can contain ${FileName} tags,
        which will be replaced with the content of the file with the name 'FileName'
        """
        if "file(" not in prompt:
            return prompt
        
        # Use regular expression to find all instances of file(filename) pattern in the prompt. 
        # The 'matches' collection will contain all the file names
        pattern = r'file\((.*?)\)'
        matches = re.findall(pattern, prompt)

        if matches:
            for file_name in matches:
                content: str = FileUtils.read_file(source_folder + file_name)
                prompt = prompt.replace(
                    f"file({file_name})", PromptUtils.get_file_content_block(file_name, content)
                )
        return prompt

    # todo-0: we no longer allow/require a slash as the last character of the folder name in 'folder(folder_name)' and I need
    # to update the docs to say this because currently I think it mentions the slash
    @staticmethod
    def insert_folders_into_prompt(
        prompt: str, source_folder: str, folder_names: List[str], ext_set: Set[str]
    ) -> str:
        """
        Substitute entire folder contents into the prompt. Prompts can contain ${FolderName} tags,
        which will be replaced with the content of the files inside the folder
        """
        if "folder(" not in prompt:
            return prompt
        
        source_folder_len: int = len(source_folder)
    
        # Use regular expression to find all instances of folder(foldername) pattern in the prompt. 
        # The 'matches' collection will contain all the folder names
        pattern = r'folder\((.*?)\)'
        matches = re.findall(pattern, prompt)

        if matches:
            for folder_name in matches:
                folder = source_folder if folder_name == "/" else source_folder + folder_name
                content: str = PromptUtils.build_folder_content(
                    folder,
                    source_folder_len,
                    ext_set,
                )
                prompt = prompt.replace(
                    f"folder({folder_name})", content
                )
        return prompt
