"""Tags for the agent module."""

from typing import Dict

AGENT_INSTRUCTIONS = "\n----\nCoding Agent Instructions:\n"
GENERAL_INSTRUCTIONS = "\n----\nGeneral Instructions:\n"

TAG_BLOCK_BEGIN = "block_begin"
TAG_BLOCK_END = "block_end"

TAG_FILE_BEGIN = "file_begin"
TAG_FILE_END = "file_end"

TAG_BLOCK_BEGIN_LEN = len(TAG_BLOCK_BEGIN)

template_info: Dict[str, str] = {
    "TAG_BLOCK_BEGIN": f"""{TAG_BLOCK_BEGIN}""",
    "TAG_BLOCK_END": f"""{TAG_BLOCK_END}""",
    "TAG_FILE_BEGIN": f"""{TAG_FILE_BEGIN}""",
    "TAG_FILE_END": f"""{TAG_FILE_END}""",
}
