from typing import List, Set
import argparse
from langchain.chat_models.base import BaseChatModel
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_xai import ChatXAI
from langchain_google_genai import ChatGoogleGenerativeAI
from common.python.utils import AIService
 
class AIUtils:
    """AI Utilities Class"""
    
    @staticmethod
    def file_contains_line(file_path, find_line):
        with open(file_path, "r") as file:
            for line in file:
                if line.strip()==find_line:
                    return True
        return False
    
    @staticmethod
    def create_llm(
            temperature: float,
            cfg: argparse.Namespace
        ) -> BaseChatModel:
            """Creates a language model based on the AI service."""
            print("Creating LLM: "+cfg.ai_service)
            timeout = 120  # timeout in seconds
            
            #ai-model
            if cfg.ai_service == AIService.OPENAI.value:
                llm = ChatOpenAI(
                    model=cfg.openai_model,
                    temperature=temperature,
                    api_key=cfg.openai_api_key,
                    timeout=timeout
                )
            elif cfg.ai_service == AIService.ANTHROPIC.value:
                llm = ChatAnthropic(
                    model=cfg.anth_model, # type: ignore
                    temperature=temperature,
                    api_key=cfg.anth_api_key,
                    timeout=timeout
                ) # type: ignore 
            elif cfg.ai_service == AIService.GEMINI.value:
                llm = ChatGoogleGenerativeAI(
                    model=cfg.gemini_model,
                    temperature=temperature,
                    api_key=cfg.gemini_api_key,
                    timeout=timeout
            )
            elif cfg.ai_service == AIService.XAI.value:
                llm = ChatXAI(
                    model=cfg.xai_model,
                    temperature=temperature,
                    api_key=cfg.xai_api_key,
                    timeout=timeout
                )
            else:
                raise Exception(f"Invalid AI Service: {cfg.ai_service}")
            return llm