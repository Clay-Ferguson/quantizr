import os
from fastapi import FastAPI, Header
from pydantic import BaseModel
from langchain.schema import HumanMessage, AIMessage, SystemMessage
from langchain.chat_models.base import BaseChatModel
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_community.chat_models import ChatPerplexity
from pydantic.v1.types import SecretStr
from pydantic import BaseModel
from typing import List, Optional
import traceback

# #ai-model
ANTH_OPUS_MODEL_COMPLETION_CHAT = "claude-3-opus-20240229"
ANTH_SONNET_MODEL_COMPLETION_CHAT = "claude-3-5-sonnet-20240620"
OPENAI_MODEL_COMPLETION = "gpt-4o"
OPENAI_MODEL_COMPLETION_MINI = "gpt-4o-mini"
PPLX_MODEL_COMPLETION_ONLINE = "llama-3-sonar-large-32k-online" 
PPLX_MODEL_COMPLETION_LLAMA3 = "llama-3-70b-instruct"
PPLX_MODEL_COMPLETION_CHAT = "llama-3-sonar-large-32k-chat"

app = FastAPI()

class AIBaseMessage(BaseModel):
    type: str
    content: str

class AIResponse(BaseModel):
    content: Optional[str]
    cost: Optional[float]
    error: Optional[str]
    
class AIRequest(BaseModel):
    systemPrompt: Optional[str]
    prompt: str
    messages: List[AIBaseMessage]
    service: str
    model: str
    temperature: float
    maxTokens: int
    credit: float

@app.get("/")
def index() -> str:
    return "QuantaAI Microservice is running."

@app.post("/api/query")
def api_query(req: AIRequest,
              api_key: Optional[str] = Header(None, alias="X-api-key")
    ) -> AIResponse:
    try:
        # for now we'll max out at 100k tokens allowed
        if (req.maxTokens > 100000): 
            req.maxTokens = 100000
            
        llm = getChatModel(req, api_key)
        messages = buildMessages(req)
        
        # Estimate input tokens
        input_text = "".join([msg.content for msg in req.messages])
        input_tokens = int((len(input_text)+3) / 3)
                
        # calculate predicted cost
        cost: float = calculate_cost(input_tokens, req.maxTokens, req.model)
        if (cost > req.credit):
            return AIResponse(content=None, cost=None, error="Insufficient credit. Add funds to your account.")         

        response = llm.invoke(list(messages))

        # Estimate output tokens
        output_tokens = int((len(response.content)+3) / 3)        
        cost = calculate_cost(input_tokens, output_tokens, req.model)

        # not make our return value and return it
        ret = AIResponse(content=response.content, cost=cost, error=None)
        return ret
    except Exception as e:
        return AIResponse(content=None, cost=None, error=str(e)+"\n"+traceback.format_exc())

def buildMessages(req):
    messages = []
    for msg in req.messages:
        if msg.type == "human":
            messages.append(HumanMessage(content=msg.content))
        elif msg.type == "ai":
            messages.append(AIMessage(content=msg.content))
        else:
            raise ValueError(f"Unsupported message type: {msg.type}")
        
    # Add the current human question to the messages
    messages.append(HumanMessage(content=req.prompt))

    # todo-1: we can do this cleaner, but we're doing the "If perplexity online model don't set system prompt" here
    if "online" not in req.model:    
        if req.systemPrompt is None or req.systemPrompt == "":
            req.systemPrompt = "You are a helpful agent."
        
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
    else:
        raise ValueError(f"Unsupported service: {req.service}")
    return llm

# https://www.anthropic.com/pricing#anthropic-api
# https://openai.com/api/pricing/
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

    else:
        raise RuntimeError(f"Model not supported: {model} is not supported.")

