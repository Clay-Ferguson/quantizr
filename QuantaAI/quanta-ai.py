from fastapi import FastAPI, Header
from pydantic import BaseModel
from langchain.schema import HumanMessage, AIMessage, SystemMessage
from langchain.chat_models.base import BaseChatModel
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_community.chat_models import ChatPerplexity
from langchain_core.prompts import ChatPromptTemplate
from pydantic.v1.types import SecretStr
from pydantic import BaseModel
from typing import List, Optional
import traceback

app = FastAPI()

class AIBaseMessage(BaseModel):
    type: str
    content: str

class AIResponse(BaseModel):
    inputTokens: int
    outputTokens: int
    content: str

class AIRequest(BaseModel):
    systemPrompt: Optional[str]
    prompt: str
    messages: List[AIBaseMessage]
    service: str
    model: str
    temperature: float
    maxTokens: int

@app.get("/")
def index() -> str:
    return "QuantaAI Microservice is running."

@app.post("/api/query")
def api_query(req: AIRequest,
              api_key: Optional[str] = Header(None, alias="X-api-key")
    ) -> AIResponse:
    try:
        llm = getChatModel(req, api_key)
        messages = buildMessages(req)
        response = llm.invoke(list(messages))

        # Estimate input tokens
        input_text = "".join([msg.content for msg in req.messages])
        input_tokens = int((len(input_text)+3) / 3)

        # Estimate output tokens
        output_tokens = int((len(response.content)+3) / 3)

        # not make our return value and return it
        return AIResponse(content=response.content, inputTokens=input_tokens, outputTokens=output_tokens)
    except Exception as e:
        return AIResponse(content="```\n"+str(e)+"\n"+traceback.format_exc()+"```", inputTokens=0, outputTokens=0)

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

    # todo-0: we can do this cleaner, but we're doing the "If perplexity online model don't set system prompt" here
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
        # todo-0: what about max_tokens?
        llm = ChatOpenAI(
            model=req.model,
            temperature=req.temperature,
            api_key=api_key,
            verbose=True,
        )
    elif req.service == "perplexity":
        # todo-0: what about max_tokens?
        llm = ChatPerplexity(
            model=req.model,
            temperature=req.temperature,
            pplx_api_key=api_key,
        )
    else:
        raise ValueError(f"Unsupported service: {req.service}")
    return llm