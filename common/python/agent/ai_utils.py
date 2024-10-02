from typing import List, Set
import argparse
from langchain.schema import BaseMessage
from langchain.chat_models.base import BaseChatModel
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
from QuantaAgent.app_config import AppConfig
from common.python.agent.app_agent import QuantaAgent
from common.python.utils import AIService, RefactorMode 
 
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
    def ask_agent(cfg: argparse.Namespace, ext_set: Set[str], folders_to_include: List[str]) -> None: 
        """Ask the AI. If ParsePrompt is True, then the prompt is extracted from the project files."""
        print("Running ask_agent")
        messages: List[BaseMessage] = []
        mode = RefactorMode.REFACTOR.value
        llm: BaseChatModel = AIUtils.create_llm(cfg.ai_service, 0.0, cfg)
        prompt = ""
        agent = QuantaAgent()
        agent.run(
            "",
            cfg.ai_service,
            mode,
            "",
            messages,
            prompt,
            True,
            cfg.source_folder,
            folders_to_include,
            cfg.data_folder,
            ext_set,
            llm,
            cfg.ok_hal
        )
    
    @staticmethod
    def create_llm(
            ai_service: str,
            temperature: float,
            cfg: argparse.Namespace
        ) -> BaseChatModel:
            """Creates a language model based on the AI service."""
            print("Creating LLM: "+ai_service)
            timeout = 120  # timeout in seconds
            
            if ai_service == AIService.OPENAI.value:
                llm = ChatOpenAI(
                    model=cfg.openai_model,
                    temperature=temperature,
                    api_key=cfg.openai_api_key,
                    timeout=timeout
                )
            elif ai_service == AIService.ANTHROPIC.value:
                llm = ChatAnthropic(
                    model=cfg.anth_model, # type: ignore
                    temperature=temperature,
                    api_key=cfg.anth_api_key,
                    timeout=timeout
                ) # type: ignore 
            elif ai_service == AIService.GEMINI.value:
                llm = ChatGoogleGenerativeAI(
                    model=cfg.gemini_model,
                    temperature=temperature,
                    api_key=cfg.gemini_api_key,
                    timeout=timeout
            )
            else:
                raise Exception(f"Invalid AI Service: {ai_service}")
            return llm