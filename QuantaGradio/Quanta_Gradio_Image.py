"""Runs a basic ChatBot using Gradio interface.
You can use this as the simplest possible test to verify that Gradio is working.
"""

import gradio as gr
from openai import OpenAI
import openai
import sys
import os
import gradio as gr

ABS_FILE = os.path.abspath(__file__)
PRJ_DIR = os.path.dirname(os.path.dirname(ABS_FILE))
sys.path.append(PRJ_DIR)

from app_config import AppConfig

if __name__ == "__main__":
    print("Quanta Gradio Image Gen Starting...")
    AppConfig.init_config()
    openai.api_key = AppConfig.cfg.openai_api_key

    def generate_image(prompt):
        try:
            client = OpenAI(api_key=AppConfig.cfg.openai_api_key)
            response = client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                size="1024x1024",
                quality="standard",
                n=1,
            )
            image_url = response.data[0].url
            return image_url
            
        except Exception as e:
            print(f"Error: {str(e)}")
            return str(e)

    iface = gr.Interface(
        fn=generate_image,
        inputs=gr.Textbox(lines=2, placeholder="Enter your image description here..."),
        outputs="image",
        title="Image Gen with OpenAI DALL-E 3",
        description="Enter a description and click 'Submit' to generate an image."
    )

    iface.launch()        
    