"""Utilities Module"""

import argparse

from common.python.streamlit_utils import StreamlitUtils


class AppUtils:
    """Utilities Class"""
    
    @staticmethod
    def setup_page(st, cfg: argparse.Namespace, title: str):
        """Displays the app header and configures the page."""
        st.set_page_config(page_title=title, page_icon="🤖", layout="wide")

        # Create a multi-column layout
        col1, col2 = st.columns([4, 1])

        # Display the header in the first column
        with col1:
            st.header(title)

        # Display the logo image in the second column
        with col2:
            st.image("img/logo-100px-tr.jpg", width=100)

        AppUtils.set_default_session_vars(st, cfg)
        StreamlitUtils.keep_session_vars(st)

    @staticmethod
    def set_default_session_vars(st, cfg: argparse.Namespace):
        """Sets the default session variables."""
        if "p_mode" not in st.session_state:
            st.session_state.p_mode = cfg.mode
        if "p_ai_service" not in st.session_state:
            st.session_state.p_ai_service = cfg.ai_service
        if "p_agent_user_input" not in st.session_state:
            st.session_state.p_agent_user_input = ""
        if "p_chatbot_user_input" not in st.session_state:
            st.session_state.p_chatbot_user_input = ""
        if "p_user_inputs" not in st.session_state:
            st.session_state.p_user_inputs = {}
        if "p_agent_messages" not in st.session_state:
            st.session_state.p_agent_messages = []
        if "p_chatbot_messages" not in st.session_state:
            st.session_state.p_chatbot_messages = []

