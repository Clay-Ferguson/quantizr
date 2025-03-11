import argparse
from langchain.chat_models.base import BaseChatModel
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_xai import ChatXAI
from langchain_google_genai import ChatGoogleGenerativeAI
from common.python.utils import AIService
from langchain.schema import HumanMessage, AIMessage
from gradio import ChatMessage
from typing import List
from pydantic import Field
from langchain_core.tools import BaseTool
from common.python.agent.tools.CreateFile import CreateFile
from common.python.agent.tools.DirectoryListing import DirectoryListing
from common.python.agent.tools.ReadFile import ReadFile
from common.python.agent.tools.UpdateBlock import UpdateBlock
from common.python.agent.tools.GetBlockInfo import GetBlockInfo
from common.python.agent.tools.LocateFile import LocateFile
from common.python.agent.tools.WriteFile import WriteFile
from .models import FileSources

 
class AIUtils:
    """AI Utilities Class"""
    
    @staticmethod
    def file_contains_line(file_path, find_line):
        with open(file_path, "r") as file:
            for line in file:
                if line.strip()==find_line:
                    return True
        return False
    
    # todo-0: make max_tokens configurable.
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
                    max_tokens=16_000, # type: ignore
                    api_key=cfg.openai_api_key,
                    timeout=timeout,
                    cache=False
                )
            elif cfg.ai_service == AIService.ANTHROPIC.value:
                llm = ChatAnthropic(
                    model=cfg.anth_model, # type: ignore
                    temperature=temperature,
                    max_tokens=40_000, # type: ignore
                    api_key=cfg.anth_api_key,
                    timeout=timeout,
                    cache=False
                )
            elif cfg.ai_service == AIService.GEMINI.value:
                llm = ChatGoogleGenerativeAI(
                    model=cfg.gemini_model,
                    temperature=temperature,
                    max_tokens=16_000,
                    api_key=cfg.gemini_api_key,
                    timeout=timeout,
                    cache=False
            )
            elif cfg.ai_service == AIService.XAI.value:
                llm = ChatXAI(
                    model=cfg.xai_model,
                    temperature=temperature,
                    max_tokens=16_000,
                    api_key=cfg.xai_api_key,
                    timeout=timeout,
                    cache=False
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
        usage_metadata = None
        
        # This is the chatbot node in the "Node Graph"
        if "chatbot" in chunk:
            for message in chunk["chatbot"]["messages"]:
                if message.content:
                    content += f"{AIUtils.get_agent_response_string(message.content)}\n"
        
        if "messages" in chunk:
            for message in chunk["messages"]:
                if message.content:
                    content += f"{AIUtils.get_agent_response_string(message.content)}\n"
                    
        if "agent" in chunk:
            for message in chunk["agent"]["messages"]:
                # Capture usage metadata if available
                if hasattr(message, 'usage_metadata'):
                    usage_metadata = message.usage_metadata
                
                # todo1: I have a feeling this "tool_calls" path is obsolete, no longer used by LangGraph. This section doesn"t execute for tools.
                if "tool_calls" in message.additional_kwargs:
                # If the message contains tool calls, extract and display an informative message with tool call details

                    # Extract all the tool calls
                    tool_calls = message.additional_kwargs["tool_calls"]

                    # Iterate over the tool calls
                    for tool_call in tool_calls:
                        # Extract the tool name
                        tool_name = tool_call["function"]["name"]

                        # Extract the tool query
                        tool_arguments = eval(tool_call["function"]["arguments"])
                        tool_query = tool_arguments["query"]


                        # Display an informative message with tool call details
                        msg = f"\nAgent: The agent is calling the tool <tool>{tool_name}</tool> with the query <query>{tool_query}</query>. Please wait for the agent's answer..."
                        content += msg
                        print(msg)
                else:
                    # If the message doesn"t contain tool calls, extract and display the agent"s answer

                    # Extract the agent"s answer
                    agent_answer = message.content

                    # Display the agent"s answer
                    print(f"\nAgent:\n{agent_answer}")
                    if message.content:
                        content += f"{AIUtils.get_agent_response_string(message.content)}\n"
                
        if "tools" in chunk:
            for message in chunk["tools"]["messages"]:
                if message.content:
                    content += f"🛠️ Tool {message.name}: {AIUtils.get_agent_response_string(message.content)}\n"
           
        if isinstance(chunk, str):
            # Direct string output (common in simple responses)
            content += chunk+"\n"            
              
        if content.strip():
            messages.append(ChatMessage(role="assistant", content=content.strip()))

        # todo-1: We're not making use of this data for actually charging to the account, yet. We're using our estimated value.
        # if usage_metadata:
        #     print(f">>>>>>>>>>>>>>>> Usage metadata: {usage_metadata}")

        return usage_metadata

    # Old version of this method from when we were using `langgraph.prebuilt` `chat_agent_executor`` instead of `create_react_agent`, which I'm keeping
    # for future reference
    @staticmethod
    def handle_agent_response_item_OLD(chunk, messages, include_tool_usage):
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
                    
        if isinstance(chunk, str):
            # Direct string output (common in simple responses)
            content += chunk+"\n"                 
                                      
        messages.append(ChatMessage(role="assistant", content=content.strip()))


@staticmethod
def init_tools(file_sources: FileSources) -> List[BaseTool]:
    """Initialize tools for the agent."""
    
    return [
        GetBlockInfo(file_sources),
        UpdateBlock(file_sources),
        CreateFile(file_sources),
        DirectoryListing(file_sources),
        ReadFile(file_sources),
        WriteFile(file_sources),
        LocateFile(file_sources)
    ]
