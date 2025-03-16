"""String Utilities Module"""


class StringUtils:
    """String Utilities Class"""

    @staticmethod
    def post_process_template(prompt: str) -> str:
        """
        - Remove the ending slash from lines.
        - And remove all lines in the prompt that start with `-- ` because they are comments.
        - Remove all lines between `meta_begin` and `meta_end` (inclusive).
        """
        
        final_prompt = ""
        in_meta_section = False
        
        for line in prompt.split("\n"):
            ls_line = line.lstrip()
            if ls_line.startswith("-- "):
                continue
            elif ls_line == "meta_begin":
                in_meta_section = True
                continue
            elif ls_line == "meta_end":
                in_meta_section = False
                continue
            
            if not in_meta_section:               
                # Strip the line and add it to the final prompt
                final_prompt += line.rstrip() + "\n"
            

        final_prompt = final_prompt.replace("\\\n", "")
        return final_prompt

    @staticmethod
    def add_filename_suffix(filename: str, suffix: str) -> str:
        """Inject a suffix into a filename."""

        parts = filename.split(".")
        if len(parts) == 1:  # No file extension
            return f"{filename}{suffix}"
        else:
            return f"{'.'.join(parts[:-1])}{suffix}.{parts[-1]}"
