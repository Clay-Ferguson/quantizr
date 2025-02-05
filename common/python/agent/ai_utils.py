import argparse
from langchain.chat_models.base import BaseChatModel
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_xai import ChatXAI
from langchain_google_genai import ChatGoogleGenerativeAI
from common.python.utils import AIService
from langchain.schema import HumanMessage, AIMessage
from gradio import ChatMessage
 
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
        
    @staticmethod
    def gradio_messages_to_langchain(messages):
        """Converts Gradio messages to LangChain messages."""
        langchain_messages = []
        for msg in messages:
            if msg['role'] == "user":
                langchain_messages.append(HumanMessage(content=msg['content']))
            elif msg['role'] == "assistant":
                langchain_messages.append(AIMessage(content=msg['content']))
        return langchain_messages
        
    @staticmethod
    def get_agent_response_string(msg):
        if isinstance(msg, str):
            return msg
        
        if isinstance(msg, list):
            ret = ""
            for m in msg:
                if "text" in m:
                    ret += m["text"]+"\n"
                elif isinstance(m, str):
                    ret += m+"\n"
            return ret
        
        # otherwise just return the string representation
        return str(msg)
        
    @staticmethod
    def handle_agent_response_item(chunk, messages, include_tool_usage):
        print("AGENT RESPONSE CHUNK: "+str(chunk))
        content = ""
        if "agent" in chunk:
            agnt = chunk["agent"]
            if agnt is not None and "messages" in agnt:
                for msg in agnt["messages"]:
                    content += f"{AIUtils.get_agent_response_string(msg.content)}\n"
            
        if "tools" in chunk:
            if include_tool_usage:
                toolz = chunk["tools"]
                if toolz is not None and "messages" in toolz:
                    for msg in toolz["messages"]:
                        content += f"🛠️ Tool {msg.name}: {AIUtils.get_agent_response_string(msg.content)}\n"
                
        if "final_answer" in chunk:
            # Final response from the agent
            content += str(chunk["final_answer"])+"\n"
            
        if "intermediate_steps" in chunk:
            # Intermediate reasoning steps
            for step in chunk["intermediate_steps"]:
                content += f"Thinking: {step.action.log}\n"
        
        if "output" in chunk:
            # Generic output field
            content += str(chunk["output"])+"\n"
                    
        if isinstance(chunk, str):
            # Direct string output (common in simple responses)
            content += chunk+"\n"                 
                                      
        messages.append(ChatMessage(role="assistant", content=content.strip()))

