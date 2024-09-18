"""Runs the Agent, as a Streamlit app."""

import sys
import os
import streamlit as st

ABS_FILE = os.path.abspath(__file__)
PRJ_DIR = os.path.dirname(os.path.dirname(ABS_FILE))
sys.path.append(PRJ_DIR)

from app_utils import AppUtils
from app_config import AppConfig
from common.python.utils import RefactorMode, AIService, Utils

def show_mode_picker(st):
    """Show the mode picker."""

    # Define the mapping between keys and display values
    mode_mapping = {
        RefactorMode.REFACTOR.value: "Allow Refactoring",
        RefactorMode.NONE.value: "No Refactoring",
    }

    def mode_changed():
        clear_agent_state()

    st.radio(
        "Coding Assistant Mode:",
        list(mode_mapping.keys()),
        key="p_mode",
        format_func=lambda x: {
            RefactorMode.REFACTOR.value: "AI is allowed to create and update files.",
            RefactorMode.NONE.value: "No refactoring. Only question answering.",
        }[x],
        on_change=mode_changed,
    )

def clear_agent_state():
    """Clear all agent session state."""
    messages = []
    st.session_state.p_agent_messages = messages
    st.session_state.p_agent_user_input = ""
    st.session_state.p_user_inputs = {}


def show_ai_model_picker(st):
    """Show the AI model picker."""

    # Define the mapping between keys and display values
    mode_mapping = {
        AIService.OPENAI.value: "OpenAI",
        AIService.ANTHROPIC.value: "Anthropic",
        AIService.GEMINI.value: "Gemini",
    }

    st.radio(
        "Select AI Service:",
        list(mode_mapping.keys()),
        key="p_ai_service",
        format_func=lambda x: {
            AIService.OPENAI.value: "OpenAI",
            AIService.ANTHROPIC.value: "Anthropic",
            AIService.GEMINI.value: "Gemini",
        }[x],
        # on_change=mode_changed,
    )


# to Run: `streamlit run Quanta_Agent.py`

if __name__ == "__main__":
    cfg = AppConfig.get_config(None)
    
    Utils.init_logging(cfg.data_folder + "/quanta_agent.log")
    print("Quanta Agent Started")

    AppUtils.setup_page(st, cfg, "Quanta: AI Tools")
    show_ai_model_picker(st)
    show_mode_picker(st)

    # Sanity check
    # st.write(st.session_state)
