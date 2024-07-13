import os
from fastapi import FastAPI, Header
from pydantic import BaseModel
from openai import OpenAI
from langchain.schema import HumanMessage, AIMessage, SystemMessage
from langchain.chat_models.base import BaseChatModel
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_community.chat_models import ChatPerplexity
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains import LLMChain
from langchain_community.utilities.dalle_image_generator import DallEAPIWrapper
from langchain_core.prompts import PromptTemplate
from langchain_openai import OpenAI
from pydantic.v1.types import SecretStr
from pydantic import BaseModel
from typing import List, Optional
import traceback

ANTH_OPUS_MODEL_COMPLETION_CHAT = "claude-3-opus-20240229"
ANTH_SONNET_MODEL_COMPLETION_CHAT = "claude-3-5-sonnet-20240620"
OPENAI_MODEL_COMPLETION = "gpt-4o"
PPLX_MODEL_COMPLETION_ONLINE = "llama-3-sonar-large-32k-online" 
PPLX_MODEL_COMPLETION_LLAMA3 = "llama-3-70b-instruct"
PPLX_MODEL_COMPLETION_CHAT = "llama-3-sonar-large-32k-chat"

# Langchain doesn't work. So we call OpenAI directly, for now.
LANGCHAIN_IMAGE_GEN = False

app = FastAPI()

class AIBaseMessage(BaseModel):
    type: str
    content: str

class AIResponse(BaseModel):
    content: Optional[str]
    cost: Optional[float]
    error: Optional[str]
    
class AIImageResponse(BaseModel):
    url: Optional[str]
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

class AIImageRequest(BaseModel):
    prompt: str
    service: str
    model: str
    credit: float
    temperature: float

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

# I'm putting this method on hold for now. I have spent the entier day 7/12/24 trying to get these trivial few lines of code
# to work and at this point it's clear there's some kind of incompatibility between the packages, and reinstalling them all doesn't fix it
# Since I don't personally care much about the image generation, I'm stoping work on this for now. To fix this I will need to run
# outside of docker and step thru the code to see what's going on. It's saying 'image' is not found on 'client' and it's a well-known issue
# on the openai forums and stack overflow, but supposedly it's fixed in the latest version of the package, and I'm USING the latest package.
# People were speculating it even would keep showing this error until PYTHON itself is updated, but I'm in a recent version of python too,
# so this is just one mystery after another.
@app.post("/api/image")
def api_image(req: AIImageRequest,
              api_key: Optional[str] = Header(None, alias="X-api-key")
    ) -> AIImageResponse:
    raise ValueError("Image generation is not supported at this time.")
    # try:
    #     # # for now we'll max out at 100k tokens allowed
    #     # if (req.maxTokens > 100000): 
    #     #     req.maxTokens = 100000
        
    #     # # Estimate input tokens
    #     # input_text = "".join([msg.content for msg in req.messages])
    #     # input_tokens = int((len(input_text)+3) / 3)
                
    #     # # calculate predicted cost
    #     # cost: float = calculate_cost(input_tokens, req.maxTokens, req.model)
    #     # if (cost > req.credit):
    #     #     return AIResponse(content=None, cost=None, error="Insufficient credit. Add funds to your account.")         

    #     url = None
    #     if LANGCHAIN_IMAGE_GEN:  
    #         os.environ["OPENAI_API_KEY"] = api_key
    #         llm = getImageModel(req, api_key)
    #         prompt = PromptTemplate(
    #             input_variables=["image_desc"],
    #             template="Generate a detailed prompt to generate an image based on the following description: {image_desc}",
    #         )
    #         chain = LLMChain(llm=llm, prompt=prompt)
    #         # url = DallEAPIWrapper(model_name="dall-e-3").run(chain.run(req.prompt))
    #         url = DallEAPIWrapper().run(chain.run(req.prompt))
    #     else:
    #         os.environ["OPENAI_API_KEY"] = api_key
    #         client = OpenAI()
    #         response = client.images.generate(
    #             model="dall-e-3",
    #             prompt="a white siamese cat",
    #             size="1024x1024",
    #             quality="standard",
    #             n=1,
    #         )
    #         url = response.data[0].url

    #     # Estimate output tokens
    #     # output_tokens = int((len(response.content)+3) / 3)        
    #     # cost = calculate_cost(input_tokens, output_tokens, req.model)

    #     # not make our return value and return it (todo-0: implement cost)
    #     ret = AIImageResponse(url=url, cost=0.0, error=None)
    #     return ret
    # except Exception as e:
    #     return AIImageResponse(url=None, cost=None, error=str(e)+"\n"+traceback.format_exc())

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

def getImageModel(req: AIRequest, api_key) -> BaseChatModel:
    llm: BaseChatModel = None;
    if req.service == "openai":
        llm = OpenAI(
            # model=req.model,
            temperature=req.temperature,
            # api_key=api_key,
            # verbose=True,
        )
    else:
        raise ValueError(f"Unsupported service: {req.service}")
    return llm

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
            max_tokens_to_sample=req.maxTokens,
            api_key=api_key,
            verbose=True,
        )
    elif req.service == "perplexity":
        llm = ChatPerplexity(
            model=req.model,
            temperature=req.temperature,
            max_tokens_to_sample=req.maxTokens,
            pplx_api_key=api_key,
        )
    else:
        raise ValueError(f"Unsupported service: {req.service}")
    return llm

# https://www.anthropic.com/pricing#anthropic-api
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

# IMAGE Code from deleted Java (We'll need this if we ever add back in image, vision, or tts)
    # String OPENAI_MODEL_TTS = "tts-1";
    # String OPENAI_MODEL_VISION = "gpt-4o";
    # String OPENAI_MODEL_COMPLETION = "gpt-4o";
    # String COST_CODE = "OAI"; // 3 chars allowed

    # // https://openai.com/pricing
    # private BigDecimal getImageCost(String size) {
    #     switch (size) {
    #         case "1024x1792":
    #         case "1792x1024":
    #             return new BigDecimal(0.12);
    #         case "1024x1024":
    #             return new BigDecimal(0.08);
    #         default:
    #             throw new RuntimeException("Unsupported image size: " + size);
    #     }
    # }

    # private BigDecimal getSpeechCost(String model, int promptLength) {
    #     switch (model) {
    #         case "tts-1":
    #             return new BigDecimal(0.000015 * promptLength);
    #         default:
    #             throw new RuntimeException("Unsupported speech model: " + model);
    #     }
    # }