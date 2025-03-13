import os
from typing import Type
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool
from ..models import FileSources

class ExtractJavaMethodInput(BaseModel):
    file_name: str = Field(description="Java/JavaScript/TypeScript File Name")
    method_start_line: str = Field(description="Source file line that will be the beginning of a method we want to extract (e.g., 'public void myMethod(int, String)')")


class ExtractJavaMethod(BaseTool):
    name: str = "extract_java_method"
    description: str = ""
    args_schema: Type[BaseModel] = ExtractJavaMethodInput
    return_direct: bool = False
    file_sources: FileSources = FileSources()
    
    def __init__(self, file_sources: FileSources):
        print("Initializing ExtractJavaMethod")
        super().__init__(description="Java/JavaScript/TypeScript Method Extractor: Extracts a specific method from a Java-like file (e.g., source files whose methods end with a closing curly brace)")
        self.file_sources = file_sources
    
    def _run(
        self,
        file_name: str,
        method_start_line: str,
    ) -> str:
        """Extract a method from a Java file using LanguageParser."""
        print(f"Extracting method '{method_start_line}' from file: {file_name}")
        
        # if method_start_line ends with '{', remove it
        if method_start_line.endswith('{'):
            method_start_line = method_start_line[:-1]
        
        # right trim the method_start_line
        method_start_line = method_start_line.rstrip()
        
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
                if not method_found and line_stripped.startswith(normalized_method_start.lstrip()):
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
                return "```\njava\n" + "".join(method_content) + "\n```"
            else:
                return f"Error: Method '{method_start_line}' not found in {file_name}"
            
        except Exception as e:
            return f"Error extracting method: {str(e)}"