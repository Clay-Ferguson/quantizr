"""Utilities Module"""

import re
import os
import logging
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

    @staticmethod
    def debug(message: str):
        """Logs a debug message."""
        logging.debug(message)

    @staticmethod
    def get_tool_calls_str(message: BaseMessage) -> str:
        """Returns a string representation of the tool calls in the message."""
        ret = ""
        if isinstance(message, AIMessage):
            # First check if message object has message.tool_calls that is an array
            if hasattr(message, "tool_calls") and isinstance(message.tool_calls, list):
                # If it does, we iterate over the tool_calls and return the summary
                for tool_call in message.tool_calls:
                    if hasattr(message, "name"):
                        ret += f"Tool Call: {tool_call}\n"

        return ret

    @staticmethod
    def should_include_file(ext_set: Set[str], file_name: str) -> bool:
        """Returns True if the file should be included in the scan."""
        # return file_name.endswith(tuple(AppConfig.ext_set)) # <--- AI suggested this. Didn't investigate further
        _, ext = os.path.splitext(file_name)
        return ext.lower() in ext_set

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

    # NOTE: This method is only called from Streamlit code, because the Streamlist app uses the same messages array for GUI rendering
    # that it used to send to the LangChain API, and so it potentially has content that needs to be cleaned up before rendering on screen.
    @staticmethod
    def sanitize_content(content) -> str:
        """Makes an AI response string presentable on screen."""

        # Scan all the lines in content one by one and extract the new content
        new_content: List[str] = []

        # to support blocks in blocks we use a counter to keep track of how many blocks we're in
        started_counter: int = 0

        # of content is a string type. Note: When Anthropic is running tool calls we get here with
        # content being a list of dictionaries. We need to handle that case.
        if not isinstance(content, str):
            # if type is a list then iteratively print the elements of the list
            if isinstance(content, list):
                for item in content:
                    # if item is a dict type then get the 'text' element and print it or
                    # if no text element then print the item
                    if isinstance(item, dict):
                        if "text" in item:
                            # This will normally be Anthropic's <thinking> message
                            new_content.append(item["text"])
                        # else:
                        #     TODO: Right here we could print the names of the tools used.
                        #     new_content.append(str(item))

        else:
            for line in content.splitlines(): 
                # ENDS
                if Utils.is_tag_line(line, TAG_FILE_END):
                    started_counter -= 1
                elif Utils.is_tag_line(line, TAG_BLOCK_END):
                    started_counter -= 1

                # BEGINS
                elif Utils.is_tag_line(line, TAG_FILE_BEGIN):
                    name: Optional[str] = Utils.parse_name_from_tag_line(
                        line, TAG_FILE_BEGIN
                    )
                    started_counter += 1
                    if started_counter == 1:
                        new_content.append(f"File Updated: {name}")

                elif Utils.is_tag_line(line, TAG_BLOCK_BEGIN):
                    name: Optional[str] = Utils.parse_name_from_tag_line(
                        line, TAG_BLOCK_BEGIN
                    )
                    started_counter += 1
                    if started_counter == 1:
                        new_content.append(f"Code Block Updated: {name}")

                elif started_counter == 0:
                    new_content.append(line)

        ret: str = "\n".join(new_content)
        return ret

   