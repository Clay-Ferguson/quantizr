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
    def ask_agent(parse_prompt: bool = False, cfg: argparse.Namespace = None, ext_set: Set[str] = []) -> None: 
        """Ask the AI. If ParsePrompt is True, then the prompt is extracted from the project files."""
        print("Running ask_agent")
        messages: List[BaseMessage] = []
        mode = RefactorMode.REFACTOR.value
        service = AIService.ANTHROPIC.value
        llm: BaseChatModel = AIUtils.create_llm(service, 0.0, cfg)
        prompt = ""
        agent = QuantaAgent()
        agent.run(
            "",
            service,
            mode,
            "",
            messages,
            prompt,
            parse_prompt,
            cfg.source_folder,
            "",
            cfg.data_folder,
            ext_set,
            llm
        )
    
    @staticmethod
    def create_llm(
            ai_service: str,
            temperature: float,
            cfg: AppConfig
        ) -> BaseChatModel:
            """Creates a language model based on the AI service."""
            print("Creating LLM: "+ai_service)
            
            if ai_service == AIService.OPENAI.value:
                llm = ChatOpenAI(
                    model=cfg.openai_model,
                    temperature=temperature,
                    api_key=cfg.openai_api_key
                )
            elif ai_service == AIService.ANTHROPIC.value:
                llm = ChatAnthropic(
                    model=cfg.anth_model,
                    temperature=temperature,
                    api_key=cfg.anth_api_key,
                )
            elif ai_service == AIService.GEMINI.value:
                llm = ChatGoogleGenerativeAI(
                    model=cfg.gemini_model,
                    temperature=temperature,
                    api_key=cfg.gemini_api_key,
            )
            else:
                raise Exception(f"Invalid AI Service: {ai_service}")
            return llm