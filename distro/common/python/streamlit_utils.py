"""Streamlit Utilities Module"""

import re

class StreamlitUtils:
    """Utilities Class"""
    
    @staticmethod
    def keep_session_vars(st):
        """
        Keeps the session state variables from being deleted by Streamlit.

        This is a workaround for the issue where Streamlit deletes session state variables when the page is refreshed.
        https://discuss.streamlit.io/t/mutipages-and-st-session-state-has-no-key-username/45237
        """
        for prop in st.session_state:
            if prop.startswith("p_"):
                st.session_state[prop] = st.session_state[prop]
                
    @staticmethod
    def fail_app(msg: str, st=None):
        """Exits the application with a fail message"""

        if st is not None:
            st.error(f"Error: {msg}")
        else:
            print(f"Error: {msg}")
            exit(1)

    @staticmethod
    def st_markdown(st, markdown_string):
        """Renders markdown with images in Streamlit.
        We need this method only because Streamlit's markdown does not support localhost images.
        """
        parts = re.split(r"!\[(.*?)\]\((.*?)\)", markdown_string)
        for i, part in enumerate(parts):
            if i % 3 == 0:
                st.markdown(part)
            elif i % 3 == 1:
                title = part
            else:
                st.image(part)  # Add caption if you want -> , caption=title)