"""Loads configuration from config.yaml and secrets.yaml files."""

import os
import re
from typing import List, Set
import argparse
import configargparse

class AppConfig:
    """Loads configuration from config.yaml and secrets.yaml files."""

    ext_list: List[str] = []
    ext_set: Set[str] = set()    
    cfg: argparse.Namespace
    source_folder_len: int
    folders_to_include: List[str] = []
    folders_to_exclude: List[str] = []

    @staticmethod
    def init_config():
        """Loads configuration from config.yaml and secrets.yaml files."""

        config_file = "config.yaml"
        secrets_file: str = "../../secrets/secrets.yaml"

        if not os.path.isfile(config_file):
            print(f"WARNING: File not found: {config_file}")

        if not os.path.isfile(secrets_file):
            print(f"WARNING: File not found: {secrets_file}")

        p = configargparse.ArgParser(default_config_files=[config_file, secrets_file])
        p.add_argument(
            "-v", "--verbose", action="store_true", help="Enable verbose output"
        )
        p.add_argument(
            "-s",
            "--capture-output",
            action="store_true",
            help="Disable capturing of stdout/stderr",
        )
        p.add_argument(
            "-c",
            "--config",
            required=False,
            is_config_file=True,
            help="config file path",
        )
        p.add_argument("--openai_api_key", required=True, help="API key for OpenAI")
        p.add_argument("--anth_api_key", required=True, help="API key for Anthropic")
        p.add_argument("--gemini_api_key", required=True, help="API key for Gemini")
        p.add_argument("--xai_api_key", required=True, help="API key for XAI")
        
        p.add_argument("--openai_model", required=True, help="OpenAI model name")
        p.add_argument("--anth_model", required=True, help="Anthropic model name")
        p.add_argument("--gemini_model", required=True, help="Anthropic model name")
        p.add_argument("--xai_model", required=True, help="XAi model name")

        p.add_argument("--ai_service", required=True, help="AI Service")
        p.add_argument("--folders_to_include", required=True, help="Folders to Include")
        p.add_argument("--folders_to_exclude", required=True, help="Folders to Exclude")
        p.add_argument(
            "--scan_extensions",
            required=True,
            help="Comma separated list of file extensions to scan",
        )
        p.add_argument(
            "--data_folder",
            required=True,
            help="Holds all generated response files, logged for analysis, debugging, or just record keeping",
        )
        p.add_argument(
            "--source_folder", required=True, help="Folder with source files to scan"
        )
        p.add_argument(
            "--mode",
            required=True,
            help="Update mode for the files (files or blocks)",
        )

        AppConfig.cfg = p.parse_args()        
        AppConfig.ext_list = re.split(r"\s*,\s*", AppConfig.cfg.scan_extensions)
        AppConfig.folders_to_include = re.split(r"\s*,\s*", AppConfig.cfg.folders_to_include)
        AppConfig.folders_to_exclude = re.split(r"\s*,\s*", AppConfig.cfg.folders_to_exclude)
        
        # remove all empty strings from folders_to_include and folders_to_exclude
        AppConfig.folders_to_include = list(filter(None, AppConfig.folders_to_include))
        AppConfig.folders_to_exclude = list(filter(None, AppConfig.folders_to_exclude))
        
        AppConfig.ext_set = set(AppConfig.ext_list)
        AppConfig.source_folder_len = len(AppConfig.cfg.source_folder)
        
        if (AppConfig.cfg):
            print("Configuration loaded")   
        else:
            print("Configuration load failed")
