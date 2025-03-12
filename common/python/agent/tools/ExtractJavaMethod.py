import javalang
from typing import Type
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool
from ..models import FileSources

class ExtractJavaMethodInput(BaseModel):
    file_name: str = Field(description="Java File Name")
    method_name: str = Field(description="Method name with signature (e.g., 'myMethod(int, String)')")


# todo-0: I have a bunch of type ignores in this method and I need to learn how to make it right, it seems like we can make this fully typesafe.
class ExtractJavaMethod(BaseTool):
    name: str = "extract_java_method"
    description: str = ""
    args_schema: Type[BaseModel] = ExtractJavaMethodInput
    return_direct: bool = False
    file_sources: FileSources = FileSources()
    
    def __init__(self, file_sources: FileSources):
        super().__init__(description="Java Method Extractor: Extracts a specific method from a Java file")
        self.file_sources = file_sources
    
    def _run(
        self,
        file_name: str,
        method_name: str,
    ) -> str:
        """Extract a method from a Java file."""
        print(f"Extracting method '{method_name}' from file: {file_name}")
        
        # Normalize the file path
        if not file_name.startswith("/"):
            file_name = "/" + file_name
        full_file_name = self.file_sources.source_folder + file_name
        
        try:
            with open(full_file_name, 'r') as f:
                java_code = f.read()
        except FileNotFoundError:
            return f"Error: File not found: {full_file_name}"

        try:
            tree = javalang.parse.parse(java_code)
        except javalang.parser.JavaSyntaxError as e:
            return f"Error: Syntax error in Java file: {e}"

        for path, node in tree.filter(javalang.parser.tree.MethodDeclaration):
            # Extract the method name from the node
            current_method_name = node.name # type: ignore
            print(f"Checking method: {current_method_name}")
            
            # Build a method signature to compare with the input method_name
            method_signature = current_method_name + "("
            
            # Add parameter types to the signature
            for i, param in enumerate(node.parameters): # type: ignore
                method_signature += param.type.name
                if i < len(node.parameters) - 1: # type: ignore
                    method_signature += ", "
            method_signature += ")"

            if method_signature == method_name:
                # Get the start and end positions of the method in the code
                start_position = node.position
                end_position = node.body[-1].position if node.body and node.body else node.position # type: ignore
                
                # Extract the lines of code corresponding to the method
                start_line = start_position.line # type: ignore
                end_line = end_position.line # type: ignore

                lines = java_code.splitlines()
                method_lines = lines[start_line - 1:end_line]
                
                method_code = "\n".join(method_lines)
                print(f"    Method found and extracted: {len(method_code)} characters")
                return method_code

        return f"Error: Method '{method_name}' not found in {file_name}"

