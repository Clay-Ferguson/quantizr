"""Streamlit Utilities Module"""

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