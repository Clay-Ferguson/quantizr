"""
Runs a basic ChatBot using Gradio interface which can talk to you about files you upload. 

So far we have only tested with images, and it's not known/proven if this works with other file types, but 
for sure the file_types variable below would be needed to allow other types.
"""

import sys
import os
import gradio as gr
from langchain.schema import AIMessage, HumanMessage
import base64
from typing import List, Dict, Any
import mimetypes

ABS_FILE = os.path.abspath(__file__)
PRJ_DIR = os.path.dirname(os.path.dirname(ABS_FILE))
sys.path.append(PRJ_DIR)

from app_config import AppConfig
from common.python.agent.ai_utils import AIUtils
from common.python.utils import Utils

if __name__ == "__main__":
    print("Quanta Gradio Image Chat Starting...")
    Utils.check_conda_env("quanta_gradio")
    AppConfig.init_config()
    Utils.init_logging(f"{AppConfig.cfg.data_folder}/Quanta_Gradio_ImageChat.log")
    
    llm = AIUtils.create_llm(0.0, AppConfig.cfg)

    def encode_image_to_base64(file_path: str) -> str:
        """Convert an image file to base64 encoding."""
        with open(file_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')

    def get_mime_type(file_path: str) -> str:
        """Get the MIME type of a file."""
        mime_type, _ = mimetypes.guess_type(file_path)
        return mime_type or "application/octet-stream"

    def create_multimodal_message(text: str, file_paths: List[str]) -> HumanMessage:
        """Create a multimodal message with text and images."""
        content: List[Dict[str, Any]] = [{"type": "text", "text": text}]
        
        for file_path in file_paths:
            mime_type = get_mime_type(file_path)
            if mime_type.startswith('image/'):
                image_data = encode_image_to_base64(file_path)
                content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{mime_type};base64,{image_data}"
                    }
                })
        
        return HumanMessage(content=list(content))

    def predict(message, history):        
        chat_history = AIUtils.gradio_messages_to_langchain(history)

        # if 'message' is a dict object print "dict"
        if isinstance(message, dict):
            text = message.get('text', '')
            files = message.get('files', [])
            
            if files and len(files) > 0:
                # Create multimodal message with both text and images
                current_message = create_multimodal_message(text, files)
            else:
                # Text-only message
                current_message = HumanMessage(content=text)
                
            # Add current message to history
            chat_history.append(current_message)
        else:   
            # Add current message to history
            chat_history.append(HumanMessage(content=message))
        
        # Get response from LLM
        gpt_response = llm.invoke(chat_history)
        return gpt_response.content

    gr.ChatInterface(
        fn=predict,
        multimodal=True,
        textbox=gr.MultimodalTextbox(file_count="multiple", file_types=["image"]),
        title="Quanta Image Chat",
    ).launch()

    