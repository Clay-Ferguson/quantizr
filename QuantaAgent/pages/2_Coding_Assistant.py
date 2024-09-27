""" Streamlit GUI for the Quanta Chatbot """

from typing import List
from langchain_google_genai import ChatGoogleGenerativeAI
import streamlit as st
from streamlit_chat import message
from langchain.schema import HumanMessage, AIMessage, BaseMessage
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain.chat_models.base import BaseChatModel
from app_utils import AppUtils
from common.python.agent.app_agent import QuantaAgent
from app_config import AppConfig
from common.python.agent.prompt_utils import PromptUtils
from common.python.utils import AIService, Utils


class AppAgentGUI:
    """Streamlit GUI for the Quanta Chatbot."""

    def __init__(self):
        self.cfg = AppConfig.get_config(None)

    def ask_ai(self, parse_prompt: bool = False):
        """Ask the AI. If ParsePrompt is True, then the prompt is extracted from the project files."""
        # initialize message history
        if "p_agent_messages" not in st.session_state:
            messages: List[BaseMessage] = []
            st.session_state.p_agent_messages = messages

        llm: BaseChatModel = None
        if st.session_state.p_ai_service == AIService.OPENAI.value:
            llm = ChatOpenAI(
                model=self.cfg.openai_model,
                temperature=0.0, # Use zero temp for code refactoring,
                api_key=self.cfg.openai_api_key
            )
        elif st.session_state.p_ai_service == AIService.ANTHROPIC.value:
             llm = ChatAnthropic(
                model_name=self.cfg.anth_model,
                temperature=0.0, # Use zero temp for code refactoring,
                api_key=self.cfg.anth_api_key,
            )
        elif st.session_state.p_ai_service == AIService.GEMINI.value:
            llm = ChatGoogleGenerativeAI(
                model=self.cfg.gemini_model,
                temperature=0.0,
                api_key=self.cfg.gemini_api_key,
        )
        else:
            raise Exception(f"Invalid AI Service: {st.session_state.p_ai_service}")

        # handle user input
        user_input = st.session_state.p_agent_user_input
        if user_input or parse_prompt:
            with st.spinner("Thinking..."):
                agent = QuantaAgent()
                agent.run(
                    "",
                    st.session_state.p_ai_service,
                    st.session_state.p_mode,
                    "",
                    st.session_state.p_agent_messages,
                    user_input,
                    parse_prompt,
                    self.cfg.source_folder,
                    "",
                    self.cfg.data_folder,
                    AppConfig.ext_set,
                    llm
                )
                if parse_prompt:
                    user_input = agent.prj_loader.parsed_prompt
                    
                st.session_state.p_user_inputs[id(agent.human_message)] = user_input
                st.session_state.p_agent_user_input = ""

    def show_messages(self):
        """display message history"""
        default_messages: List[BaseMessage] = []
        messages = st.session_state.get("p_agent_messages", default_messages)
        for i, msg in enumerate(messages):
            if isinstance(msg, HumanMessage):
                # I'm not sure if this is a bug or what, when this message is missing, but if so it's related
                # to clearing the messages with the clear button
                # if id(msg) is not in user_inputs, just make user_input be "message gone"
                if id(msg) not in st.session_state.p_user_inputs:
                    st.session_state.p_user_inputs[id(msg)] = "Message Gone"

                user_input = st.session_state.p_user_inputs[id(msg)]
                message(user_input, is_user=True, key=str(i) + "_user")
            elif isinstance(msg, AIMessage):
                content: str = msg.content  # type: ignore
                if content:
                    content = Utils.sanitize_content(content)
                    message(str(content), is_user=False, key=str(i) + "_ai")

    def show_form(self):
        """Show the form for user input."""
        with st.form("agent_form"):
            st.text_area(
                label="Ask the AI a Question (or ask for a Code Refactor to be done): ",
                key="p_agent_user_input",
            )
            col1, col2, col3 = st.columns(3)
            with col1:
                st.form_submit_button("Ask AI", on_click=lambda: self.ask_ai(False))
            with col2:
                st.form_submit_button("Run HAL", on_click=lambda: self.ask_ai(True))
            with col3:
                st.form_submit_button("Clear", on_click=self.clear_agent_state)

    def clear_agent_state(self):
        """Clear all agent session state."""
        messages = []
        st.session_state.p_agent_messages = messages
        st.session_state.p_agent_user_input = ""
        st.session_state.p_user_inputs = {}

    def run(self):
        """Main function for the Streamlit GUI."""
        AppUtils.setup_page(st, self.cfg, "Quanta: AI Coding Agent")

        self.show_messages()
        self.show_form()

        with st.expander("Helpful Tips. Read this first!"):
            st.markdown(PromptUtils.get_template("config/agent_chat_tips.txt"))

        # Sanity check
        # st.write(st.session_state)


AppAgentGUI().run()
