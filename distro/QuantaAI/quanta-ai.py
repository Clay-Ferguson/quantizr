from fastapi import FastAPI, Header
from pydantic import BaseModel
from langchain.schema import HumanMessage, SystemMessage
from langchain.chat_models.base import BaseChatModel
from langchain_anthropic import ChatAnthropic
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
        llm: BaseChatModel = None;
        if req.service == "anthropic":
            llm = ChatAnthropic(
                    model_name=req.model,
                    temperature=req.temperature,
                    max_tokens_to_sample=req.maxTokens,
                    timeout=120,  # timeout in seconds
                    api_key=SecretStr(api_key),
                )
        else:
            raise ValueError(f"Unsupported service: {req.service}")

        if req.systemPrompt is None or req.systemPrompt == "":
            req.systemPrompt = "You are a helpful agent."
        
        # Check the first 'message' to see if it's a SystemMessage and if not then insert one
        if len(req.messages) == 0 or not isinstance(req.messages[0], SystemMessage):
            req.messages.insert(0, SystemMessage(content=req.systemPrompt))
        # else we set the first message to the system prompt
        else:
            req.messages[0] = SystemMessage(content=req.systemPrompt)

        human_message = HumanMessage(content=req.prompt)
        req.messages.append(human_message)
        response = llm.invoke(list(req.messages))

        # Estimate input tokens
        input_text = "".join([msg.content for msg in req.messages])
        input_tokens = int((len(input_text) +3) / 3)

        # Estimate output tokens
        output_tokens = int((len(response.content)+3) / 3)

        # not make our return value and return it
        return AIResponse(content=response.content, inputTokens=input_tokens, outputTokens=output_tokens)
    except Exception as e:
        return AIResponse(content=str(e)+"\n"+traceback.format_exc(), inputTokens=0, outputTokens=0)
