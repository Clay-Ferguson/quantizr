"""File Utilities Module"""

import os

from io import TextIOWrapper

class FileUtils:
    """Utilities Class"""
    
    @staticmethod
    def open_file(filename: str) -> TextIOWrapper:
        """Opens file for reading."""
        return open(filename, "r", encoding="utf-8")
    
    def open_writable_file(filename: str) -> TextIOWrapper:
        """Opens file for writing."""
        return open(filename, "w", encoding="utf-8")

    @staticmethod
    def write_file(filename: str, content: str):
        """Writes content to a file."""

        with open(filename, "w", encoding="utf-8") as file:
            file.write(content)

    @staticmethod
    def read_file(filename: str) -> str:
        """Reads a file and returns the content."""
        with FileUtils.open_file(filename) as file:
            return file.read()

    @staticmethod
    def ensure_folder_exists(file_path: str):
        """Ensures that the folder for the file exists."""
        directory = os.path.dirname(file_path)
        if not os.path.exists(directory):
            os.makedirs(directory)