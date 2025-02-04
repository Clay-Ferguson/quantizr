"""Tags for the agent module."""

from typing import Dict

TAG_BLOCK_BEGIN = "block_begin"
TAG_BLOCK_END = "block_end"

TAG_BLOCK_BEGIN_LEN = len(TAG_BLOCK_BEGIN)

template_info: Dict[str, str] = {
    "TAG_BLOCK_BEGIN": f"""{TAG_BLOCK_BEGIN}""",
    "TAG_BLOCK_END": f"""{TAG_BLOCK_END}"""
}
