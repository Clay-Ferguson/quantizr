import os
import sys
from fastapi import FastAPI, Header
from pydantic import BaseModel, Field
from langchain_community.chat_models import ChatPerplexity
from langchain.schema import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain.chat_models.base import BaseChatModel
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_xai import ChatXAI
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel
from typing import List, Optional, Set
import traceback

ABS_FILE = os.path.abspath(__file__)
PRJ_DIR = os.path.dirname(os.path.dirname(ABS_FILE))
sys.path.append(PRJ_DIR)

from common.python.agent.app_agent import QuantaAgent
from common.python.utils import RefactorMode, Utils
from common.python.agent.models import FileSources

# #ai-model (WARNING: These values are in a Java file too (AIModel.java))
ANTH_OPUS_MODEL_COMPLETION_CHAT = "claude-3-opus-20240229"
ANTH_SONNET_MODEL_COMPLETION_CHAT = "claude-3-5-sonnet-20241022"
OPENAI_MODEL_COMPLETION = "gpt-4o-2024-11-20"
OPENAI_MODEL_COMPLETION_MINI = "gpt-4o-mini"
OPENAI_MODEL_COMPLETION_O1_PREVIEW = "o1-preview"
OPENAI_MODEL_COMPLETION_O1_MINI = "o1-mini"
PPLX_MODEL_COMPLETION_ONLINE = "sonar-reasoning-pro" 
GEMINI_MODEL_COMPLETION_CHAT = "gemini-1.5-pro"
GEMINI_FLASH_MODEL_COMPLETION_CHAT = "gemini-1.5-flash"
XAI_MODEL_COMPLETION_CHAT = "grok-beta"

app = FastAPI()

Utils.init_logging("/log/quanta_ai.log")
print("QuantaAI Microservice is running.")

class AIBaseMessage(BaseModel):
    type: str
    content: str

class AIResponse(BaseModel):
    content: Optional[str]
    cost: Optional[float]
    error: Optional[str]
    
# NOTE: Optional is not enough to make the field optional. You need to also default value to `Field(default=None)`
class AIRequest(BaseModel):
    systemPrompt: Optional[str] = Field(default=None)
    prompt: Optional[str] = Field(default=None)
    foldersToInclude: Optional[str] = Field(default=None)
    foldersToExclude: Optional[str] = Field(default=None)
    messages: Optional[List[AIBaseMessage]] = Field(default=None)
    service: str
    model: str
    temperature: float
    maxTokens: int
    credit: float
    codingAgent: bool
    agentFileExtensions: Optional[str]

@app.get("/")
def index() -> str:
    return "QuantaAI Microservice is running."

@app.post("/api/query")
def api_query(req: AIRequest,
              api_key: Optional[str] = Header(None, alias="X-api-key")
    ) -> AIResponse:
    try:        
        # Log the request as pretty json
        print(f"""REQ received: prompt={req.prompt}
service: {req.service}
codingAgent: {req.codingAgent}
foldersToInclude: {req.foldersToInclude}
foldersToExclude: {req.foldersToExclude}
agentFileExtensions: {req.agentFileExtensions}
maxTokens: {req.maxTokens}
temperature: {req.temperature}
""")
            
        llm = getChatModel(req, api_key)
        
        # Estimate input tokens
        if req.messages == None:
            req.messages = []
            
        input_text = "".join([msg.content for msg in req.messages])
        input_tokens = int((len(input_text)+3) / 3)
                
        # calculate predicted cost
        maxCost: float = calculate_cost(input_tokens, req.maxTokens, req.model)
        if (maxCost > req.credit):
            print("User is out of credit.")
            return AIResponse(content=None, cost=None, error="Insufficient credit. Add funds to your account, using `Menu -> AI -> Settings -> Add Credit`")         

        answer: str = ""
        response: BaseMessage | None = None
        if req.codingAgent:
            print("CodingAgent mode")
            if req.agentFileExtensions is not None:
                # Convert the comma delimted string of extensions (without leading dots) to a set of extensions with dots
                ext_set: Set[str] = {f".{ext.strip()}" for ext in req.agentFileExtensions.split(',')}

            folders_to_include = []
            if req.foldersToInclude:
                folders_to_include = req.foldersToInclude.split("\n")
                folders_to_include = list(filter(None, folders_to_include))

            folders_to_exclude = []
            if req.foldersToExclude:
                folders_to_exclude = req.foldersToExclude.split("\n")
                folders_to_exclude = list(filter(None, folders_to_exclude))

            messages = buildContext(req)
            agent = QuantaAgent()
            file_sources = FileSources("/projects", folders_to_include, folders_to_exclude, ext_set, "/data")
            
            agent.run(
                req.systemPrompt if req.systemPrompt else "",
                req.service,
                RefactorMode.REFACTOR.value,
                "",
                messages,
                req.prompt if req.prompt else "",
                file_sources,
                llm
            )
            answer = messages[-1].content # type: ignore
        else:
            print("Chat mode")
            messages = buildMessages(req)
            response = llm.invoke(messages)
            answer = response.content # type: ignore

        # Estimate output tokens
        output_tokens = int((len(answer)+3) / 3)        
        maxCost = calculate_cost(input_tokens, output_tokens, req.model)

        # not make our return value and return it
        ret = AIResponse(content=answer, cost=maxCost, error=None)
        return ret
    except Exception as e:
        return AIResponse(content=None, cost=None, error=str(e)+"\n"+traceback.format_exc())

# Builds list of past messages
def buildContext(req) -> List[BaseMessage]:
    messages = []
    
    for msg in req.messages:
        if msg.type == "human":
            messages.append(HumanMessage(content=msg.content))
        elif msg.type == "ai":
            messages.append(AIMessage(content=msg.content))
        else:
            raise ValueError(f"Unsupported message type: {msg.type}")
    return messages

def buildMessages(req):
    messages = buildContext(req)
        
    # Add the current human question to the messages
    messages.append(HumanMessage(content=req.prompt))

    if req.systemPrompt != None and req.systemPrompt.strip() != "":        
        # Check the first 'message' to see if it's a SystemMessage and if not then insert one
        if len(messages) == 0 or not isinstance(messages[0], SystemMessage):
            messages.insert(0, SystemMessage(content=req.systemPrompt))
        # else we set the first message to the system prompt
        else:
            messages[0] = SystemMessage(content=req.systemPrompt)        

    return messages

def getChatModel(req: AIRequest, api_key) -> BaseChatModel:
    llm: BaseChatModel | None = None
    timeout = 120  # timeout in seconds
    
    #ai-model
    if req.service == "anthropic":
        llm = ChatAnthropic(
            model=req.model, # type: ignore
            temperature=req.temperature,
            max_tokens=req.maxTokens, # type: ignore
            timeout=timeout,
            api_key=api_key,
        )
    elif req.service == "openai":
        llm = ChatOpenAI(
            model=req.model,
            temperature=req.temperature,
            max_completion_tokens=req.maxTokens, # Yes, OpenAI is different than the other on max tokens name here.
            timeout=timeout,
            api_key=api_key
        )
    elif req.service == "perplexity":
        llm = ChatPerplexity(
            model=req.model,
            temperature=req.temperature,
            max_tokens=req.maxTokens,
            timeout=timeout,
            api_key=api_key,
        )
    elif req.service == "gemini":
        llm = ChatGoogleGenerativeAI(
            model=req.model,
            temperature=req.temperature,
            max_tokens=req.maxTokens, # type: ignore
            timeout=timeout,
            api_key=api_key,
        )
    elif req.service == "xai":
        llm = ChatXAI(
            model=req.model,
            temperature=req.temperature,
            max_tokens=req.maxTokens,
            timeout=timeout,
            api_key=api_key
        )
    else:
        raise ValueError(f"Unsupported service: {req.service}")
    return llm # type: ignore

# https://www.anthropic.com/pricing#anthropic-api
# https://openai.com/api/pricing/
# https://ai.google.dev/pricing
# https://docs.perplexity.ai/guides/model-cards
# #ai-model
def calculate_cost(input_tokens, output_tokens, model) -> float:
    # prices per magatoken
    input_ppm = 0
    output_ppm = 0
    price_per_req = 0

    # We detect using startswith, because the actual model used will be slightly different than the
    # one specified
    if model == OPENAI_MODEL_COMPLETION:
        input_ppm = 5.0
        output_ppm = 15.0
    
    elif model == OPENAI_MODEL_COMPLETION_MINI:
        input_ppm = 0.15
        output_ppm = 0.6

    elif XAI_MODEL_COMPLETION_CHAT:
        # (todo-0: this is not true Grok pricing, they're still beta with no pricing model)
        input_ppm = 15.0
        output_ppm = 60.0

    elif OPENAI_MODEL_COMPLETION_O1_PREVIEW:
        # Not a typo! These are in dollars!
        input_ppm = 15.0
        output_ppm = 60.0
        
    elif OPENAI_MODEL_COMPLETION_O1_MINI:
        input_ppm = 3.0
        output_ppm = 12.0

    elif model == ANTH_OPUS_MODEL_COMPLETION_CHAT:
        input_ppm = 15
        output_ppm = 75

    elif model == ANTH_SONNET_MODEL_COMPLETION_CHAT:
        input_ppm = 3.0
        output_ppm = 15.0

    elif model == PPLX_MODEL_COMPLETION_ONLINE:
        input_ppm = 2.0
        output_ppm = 8.0
        price_per_req = 0.005

    elif model == GEMINI_MODEL_COMPLETION_CHAT:
        if (input_tokens <= 128_000):
            input_ppm = 3.5
        else:
            input_ppm = 7.0
            
        if (output_tokens <= 128_000):
            output_ppm = 10.5
        else:
            output_ppm = 21.0
        price_per_req = 0.005
               
    elif model == GEMINI_FLASH_MODEL_COMPLETION_CHAT:
        if (input_tokens <= 128_000):
            input_ppm = 0.075
        else:
            input_ppm = 0.15
            
        if (output_tokens <= 128_000):
            output_ppm = 0.3
        else:
            output_ppm = 0.6
        price_per_req = 0.005
       
    else:
        raise RuntimeError(f"Model not supported: {model} is not supported.")
    
    return price_per_req + (input_tokens * input_ppm / 1000_000) + (output_tokens * output_ppm / 1000_000)

