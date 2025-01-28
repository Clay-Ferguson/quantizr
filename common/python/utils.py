"""Utilities Module"""

import re
import os
import logging
import builtins
from enum import Enum
from typing import List, Set, Optional
from langchain.schema import AIMessage, BaseMessage, AIMessage
from .agent.tags import (
    TAG_FILE_BEGIN,
    TAG_FILE_END,
    TAG_BLOCK_BEGIN,
    TAG_BLOCK_END,
)

class AIService(Enum):
    OPENAI = "openai"
    ANTHROPIC = "anth"
    GEMINI = "gemini"
    XAI = "xai"

class RefactorMode(Enum):
    REFACTOR = "refactor"
    NONE = "none"

class Utils:
    """Utilities Class"""

    @staticmethod
    def init_logging(file_name: str):
        """Initializes the logging."""
        logging.basicConfig(
            filename=file_name,  # Log file name
            level=logging.DEBUG,     # Log level
            format="%(asctime)s - %(levelname)s - %(message)s"
        )
        
        # Store the original print function
        original_print = builtins.print
        
        # Redefine the print function
        def custom_print(*args, **kwargs):
            # Convert all arguments to strings and join them
            message = ' '.join(map(str, args))
            # Call Utils.debug with the joined message
            Utils.debug(message)
            original_print(*args, **kwargs)
        
        # Replace the built-in print function with our custom one
        builtins.print = custom_print

    @staticmethod
    def debug(message: str):
        """Logs a debug message."""
        logging.debug(message)

    @staticmethod
    def has_included_file_extension(ext_set: Set[str], file_name: str) -> bool:
        """Returns True if the file's extension should be included in the scan."""
        
        using_dots = any([ext.startswith(".") for ext in ext_set])
        
        _, ext = os.path.splitext(file_name)
        # if ext is empty return false
        if not ext:
            return False
        
        # If we're not using dots and 'ext' starts with a dot, remove the dot
        if not using_dots and ext[0] == ".":
            ext = ext[1:]
        
        ret = ext.lower() in ext_set
        # print(f"has_included_file_extension: {file_name} -> {ext} -> {ret}, ext_set: {ext_set}")
        return ret
    
    @staticmethod
    def allow_folder(folders_to_include: List[str], folders_to_exclude: List[str], short_dir: str) -> bool:
        """Returns True if the file's path should be included in the scan."""
        include_passed = len(folders_to_include)==0 or Utils.has_folder(folders_to_include, short_dir)
        exclude_passed = len(folders_to_exclude)==0 or not Utils.has_folder(folders_to_exclude, short_dir)        
        return include_passed and exclude_passed
    
    @staticmethod
    def has_folder(folders: List[str], short_folder: str) -> bool:
        """Returns True if the file's path should be included in the scan."""
        # Note: If there's no folders we have an empty string in here but it still works.
        for folder in folders:
            if folder and short_folder.startswith(folder):
                return True
        return False

    @staticmethod
    def has_tag_lines(prompt: str, tag: str) -> bool:
        """Checks if the prompt has this tag line."""

        # Note: the 're' module caches compiled regexes, so there's no need to store the compiled regex for reuse.
        pattern: str = rf"^(-- |// |# |) {re.escape(tag)} "
        return re.search(pattern, prompt) is not None

    @staticmethod
    def is_tag_and_name_line(line: str, tag: str, name: str) -> bool:
        """Checks if the line is a pattern like
        `-- block_begin {Name}` or `// block_begin {Name}` or `# block_begin {Name}`
        or `-- block_end {Name}` or `// block_end {Name}` or `# block_end {Name}`
        or any of those without the comment characters at the beginning of the line as well
        """

        # Note: the 're' module caches compiled regexes, so there's no need to store the compiled regex for reuse.
        pattern: str = rf"^(-- |// |# |){re.escape(tag)} {name}$"
        return re.search(pattern, line) is not None

    # If the line is something like "// block_begin name" we return name, else return None
    @staticmethod
    def parse_name_from_tag_line(line: str, tag: str) -> Optional[str]:
        """Parses the name from a `... {tag} {name}` formatted line."""
        pattern: str = rf"^(-- |// |# |){re.escape(tag)}(.+)$"
        match = re.search(pattern, line)
        if match:
            return match.group(2).strip()
        else:
            return None

    # NOTE: if exact=True it does an exact match on this line, else functions more like a "startswith"
    #       Note: This means is exact=true we're checking the nothing is to the right of the tag.
    @staticmethod
    def is_tag_line(line: str, tag: str) -> bool:
        """Checks if the line is a line like
        `-- block_begin` or `// block_begin` or `# block_begin`
        or `-- block_end` or `// block_end` or `# block_end`
        or any of those without the comment characters at the beginning of the line as well

        Notice that we only check for the tag, not the block name.
        """

        # Note: the 're' module caches compiled regexes, so there's no need to store the compiled regex for reuse.
        pattern: str = rf"^(-- |// |# |){re.escape(tag)}"

        # Forces our pattren to apply out to the end of the string (making it an exact match)
        # if exact:
        #     pattern += "$"
        return re.search(pattern, line) is not None


   