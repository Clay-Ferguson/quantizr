import os
import sys
from fastapi import FastAPI, Header
from pydantic import BaseModel, Field
from langchain.schema import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain.chat_models.base import BaseChatModel
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic.v1.types import SecretStr
from pydantic import BaseModel
from typing import List, Optional, Set
import traceback

ABS_FILE = os.path.abspath(__file__)
PRJ_DIR = os.path.dirname(os.path.dirname(ABS_FILE))
sys.path.append(PRJ_DIR)

from common.python.agent.app_agent import QuantaAgent
from common.python.utils import RefactorMode, Utils

# #ai-model
ANTH_OPUS_MODEL_COMPLETION_CHAT = "claude-3-opus-20240229"
ANTH_SONNET_MODEL_COMPLETION_CHAT = "claude-3-5-sonnet-20240620"
OPENAI_MODEL_COMPLETION = "gpt-4o"
OPENAI_MODEL_COMPLETION_MINI = "gpt-4o-mini"
PPLX_MODEL_COMPLETION_ONLINE = "llama-3-sonar-large-32k-online" 
PPLX_MODEL_COMPLETION_LLAMA3 = "llama-3-70b-instruct"
PPLX_MODEL_COMPLETION_CHAT = "llama-3-sonar-large-32k-chat"
GEMINI_MODEL_COMPLETION_CHAT = "gemini-1.5-pro"
GEMINI_FLASH_MODEL_COMPLETION_CHAT = "gemini-1.5-flash"

app = FastAPI()

Utils.init_logging("/data/quanta_ai.log")

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
    prompt: str
    foldersToInclude: str
    messages: List[AIBaseMessage]
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
        # Utils.debug("Request received", Utils.pretty_json(req.model_dump_json()))
        
        # for now we'll max out at 100k tokens allowed
        if (req.maxTokens > 100000): 
            req.maxTokens = 100000
            
        llm = getChatModel(req, api_key)
        
        # Estimate input tokens
        input_text = "".join([msg.content for msg in req.messages])
        input_tokens = int((len(input_text)+3) / 3)
                
        # calculate predicted cost
        maxCost: float = calculate_cost(input_tokens, req.maxTokens, req.model)
        if (maxCost > req.credit):
            return AIResponse(content=None, cost=None, error="Insufficient credit. Add funds to your account, using `Menu -> AI -> Settings -> Add Credit`")         

        answer: str = ""
        response: BaseMessage = None
        if req.codingAgent:
             # Convert the comma delimted string of extensions (without leading dots) to a set of extensions with dots
            ext_set: Set[str] = {f".{ext.strip()}" for ext in req.agentFileExtensions.split(',')}

            folders_to_include = []
            if req.foldersToInclude:
                folders_to_include = req.foldersToInclude.split("\n")

            messages = buildContext(req)
            agent = QuantaAgent()
            agent.run(
                req.systemPrompt,
                req.service,
                RefactorMode.REFACTOR.value,
                "",
                messages,
                req.prompt,
                # Note: These folders are defined by the docker compose yaml file as volumes.
                "/projects",
                folders_to_include,
                "/data",
                ext_set,
                llm)
            answer = messages[-1].content
        else:
            messages = buildMessages(req)
            response = llm.invoke(messages)
            answer = response.content

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
    llm: BaseChatModel = None;
    if req.service == "anthropic":
        llm = ChatAnthropic(
                model_name=req.model,
                temperature=req.temperature,
                max_tokens_to_sample=req.maxTokens,
                timeout=120,  # timeout in seconds
                api_key=SecretStr(api_key),
            )
    elif req.service == "openai":
        llm = ChatOpenAI(
            model=req.model,
            temperature=req.temperature,
            max_tokens=req.maxTokens,
            timeout=120,  # timeout in seconds
            api_key=api_key,
            verbose=True,
        )
    elif req.service == "perplexity":
        llm = ChatPerplexity(
            model=req.model,
            temperature=req.temperature,
            max_tokens_to_sample=req.maxTokens,
            request_timeout=120,  # timeout in seconds
            pplx_api_key=api_key,
        )
    elif req.service == "gemini":
        llm = ChatGoogleGenerativeAI(
            model=req.model,
            temperature=req.temperature,
            max_tokens_to_sample=req.maxTokens,
            request_timeout=120,  # timeout in seconds
            google_api_key=api_key,
        )
    else:
        raise ValueError(f"Unsupported service: {req.service}")
    return llm

# https://www.anthropic.com/pricing#anthropic-api
# https://openai.com/api/pricing/
# https://ai.google.dev/pricing
# #ai-model
def calculate_cost(input_tokens, output_tokens, model) -> float:
    input_ppm = 0
    output_ppm = 0

    # We detect using startswith, because the actual model used will be slightly different than the
    # one specified
    if model == OPENAI_MODEL_COMPLETION:
        # prices per kilotoken
        input_ppk = 0.005
        output_ppk = 0.015
        return (input_tokens * input_ppk / 1000) + (output_tokens * output_ppk / 1000)
    
    if model == OPENAI_MODEL_COMPLETION_MINI:
        # prices per kilotoken
        input_ppm = 0.15
        output_ppm = 0.6
        return (input_tokens * input_ppm / 1000000) + (output_tokens * output_ppm / 1000000)

    elif model == ANTH_OPUS_MODEL_COMPLETION_CHAT:
        # prices per megatoken
        input_ppm = 15
        output_ppm = 75
        return (input_tokens * input_ppm / 1000000) + \
               (output_tokens * output_ppm / 1000000)

    elif model == ANTH_SONNET_MODEL_COMPLETION_CHAT:
        # prices per megatoken
        input_ppm = 3.0
        output_ppm = 15.0
        return (input_tokens * input_ppm / 1000000) + \
               (output_tokens * output_ppm / 1000000)

    # 70B model
    elif model == PPLX_MODEL_COMPLETION_CHAT:
        # prices per megatoken
        input_ppm = 1.0
        output_ppm = 1.0
        return (input_tokens * input_ppm / 1000000) + \
               (output_tokens * output_ppm / 1000000)

    # 70B model
    elif model == PPLX_MODEL_COMPLETION_LLAMA3:
        # prices per megatoken
        input_ppm = 1.0
        output_ppm = 1.0
        return (input_tokens * input_ppm / 1000000) + \
               (output_tokens * output_ppm / 1000000)

    # 70B model
    elif model == PPLX_MODEL_COMPLETION_ONLINE:
        input_ppm = 1.0
        output_ppm = 1.0
        input_price_per_req = 0.005
        return input_price_per_req + (input_tokens * input_ppm / 1000000) + \
               (output_tokens * output_ppm / 1000000)

    elif model == GEMINI_MODEL_COMPLETION_CHAT:
        if (input_tokens <= 128000):
            input_ppm = 3.5
        else:
            input_ppm = 7.0
            
        if (output_tokens <= 128000):
            output_ppm = 10.5
        else:
            output_ppm = 21.0
            
        input_price_per_req = 0.005
        return input_price_per_req + (input_tokens * input_ppm / 1000000) + \
               (output_tokens * output_ppm / 1000000)
               
    elif model == GEMINI_FLASH_MODEL_COMPLETION_CHAT:
        if (input_tokens <= 128000):
            input_ppm = 0.075
        else:
            input_ppm = 0.15
            
        if (output_tokens <= 128000):
            output_ppm = 0.3
        else:
            output_ppm = 0.6
            
        input_price_per_req = 0.005
        return input_price_per_req + (input_tokens * input_ppm / 1000000) + \
               (output_tokens * output_ppm / 1000000)

    else:
        raise RuntimeError(f"Model not supported: {model} is not supported.")

