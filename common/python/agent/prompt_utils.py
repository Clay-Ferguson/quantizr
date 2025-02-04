"""Contains the prompt templates for the agent."""

from typing import Optional, Dict
from langchain.prompts import PromptTemplate
from ..string_utils import StringUtils
from .tags import (
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

