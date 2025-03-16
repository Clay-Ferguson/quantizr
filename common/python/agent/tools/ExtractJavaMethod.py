import os
from typing import Optional, Type
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool

from common.python.agent.project_loader import ProjectLoader
from ..models import FileSources

class ExtractJavaMethodInput(BaseModel):
    file_name: Optional[str] = Field(description="File Name of a Java/JavaScript/TypeScript (if known, otherwise Python `None` value)")
    method_start_line: str = Field(description="Source file line that will mark the beginning of a method we want to extract (e.g., 'public void myMethod(int, String)')")


class ExtractJavaMethod(BaseTool):
    name: str = "extract_java_method"
    description: str = ""
    args_schema: Type[BaseModel] = ExtractJavaMethodInput
    return_direct: bool = False
    file_sources: FileSources = FileSources()
    
    def __init__(self, file_sources: FileSources):
        super().__init__(description="""Method Extractor for Java/JavaScript/TypeScript Files: Extracts a specific method 
from a Java-like file (e.g., any computer language whose method definitions end with a closing curly brace).

NOTE: This tool has the ability to automatically find the right file, if no file name is specified, so if the file name is not known this method should
first be called without the file name specified, rather than calling another tool to locate the file.                                          
""")
        self.file_sources = file_sources
    
    def _run(
        self,
        file_name: Optional[str],
        method_start_line: str,
    ) -> str:
        """Extract a method from a Java file using LanguageParser."""
        print(f"Extracting method '{method_start_line}' from file: {file_name}")
        
        # if method_start_line ends with '{', remove it
        if method_start_line.endswith('{'):
            method_start_line = method_start_line[:-1]
        
        # right trim the method_start_line
        method_start_line = method_start_line.rstrip()
        had_file_name_arg = file_name is not None
        
        # if no file_name is provided
        if not file_name:
            # Use the first source folder as the default
            if self.file_sources.source_folder:
                prj_loader = ProjectLoader.get_instance(self.file_sources)
                prj_loader.scan_directory()
                file_name = prj_loader.find_file_containing(method_start_line)
            else:
                return "Error: No file name provided and no source folder available."
        
        if not file_name:
            return f"Error: No file name provided and unable to find {method_start_line} in any file."
        
        # Normalize the file path
        if not file_name.startswith("/"):
            file_name = "/" + file_name
        full_file_name = self.file_sources.source_folder + file_name
        
        try:
            if not os.path.exists(full_file_name):
                return f"Error: File not found: {full_file_name}"
                                
                    # Read the file again to get the exact code lines
            with open(full_file_name, 'r') as f:
                all_lines = f.readlines()
                
                       # Convert tabs to spaces for consistent indentation comparison
            normalized_lines = [line.replace('\t', '    ') for line in all_lines]
            normalized_method_start = method_start_line.replace('\t', '    ')
            
            method_content = []
            method_found = False
            start_indentation = None
            
            # Find the method and extract it
            for i, line in enumerate(normalized_lines):
                line_stripped = line.lstrip()
                
                # Check if this line matches the method start line
                # NOTE: Using 'line_stripped.startswith' to avoid issues with indentation
                #       if not method_found and line_stripped.startswith(normalized_method_start.lstrip()):
                if not method_found and normalized_method_start.lstrip() in line_stripped:
                    method_found = True
                    start_indentation = len(line) - len(line_stripped)  # Calculate indentation level
                    method_content.append(all_lines[i])  # Use original line for output
                    continue
                
                # If we found the method, start collecting lines
                if method_found:
                    method_content.append(all_lines[i])  # Use original line for output
                    
                    # Check if this is potentially the closing brace at the same indentation level
                    current_indentation = len(line) - len(line_stripped)
                    if line_stripped.startswith('}') and current_indentation == start_indentation:
                        # We found the end of the method
                        break
            
            if method_found:
                ret = ""
                if not had_file_name_arg:
                    # Add the file name to the output, because the AI won't know it yet, since it was not provided
                    ret = f"Found in File: {file_name}"
                ret += "\n```\n" + "".join(method_content).strip() + "\n```\n"
                return ret
            else:
                return f"Error: Method '{method_start_line}' not found in {file_name}"
            
        except Exception as e:
            return f"Error extracting method: {str(e)}"