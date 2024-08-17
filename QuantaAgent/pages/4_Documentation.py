import streamlit as st

from app_utils import AppUtils
from app_config import AppConfig
from common.python.file_utils import FileUtils
from common.python.streamlit_utils import StreamlitUtils

# Define the files lookup map
files = {
    "README.md": "Readme Text / Introduction",
    "config/help-text.md": "Coding Assistant Tips",
    "docs/named-blocks.md": "Named Blocks",
}


class Documentation:
    """Streamlit GUI for the Quanta Chatbot."""

    def __init__(self):
        self.cfg = AppConfig.get_config(None)

    def run(self):
        ### Main Documentation Page ###
        AppUtils.setup_page(st, self.cfg, "Quanta: Documentation")

        # Create a two-column layout
        col1, col2 = st.columns([1, 3])

        # Display the list of files in the left column
        with col1:
            selected_file = list(files.keys())[0]  # Set default selected file
            for file_path, friendly_name in files.items():
                if st.button(friendly_name):
                    selected_file = file_path

        # Display the content of the selected file in the right column
        with col2:
            content = FileUtils.read_file(selected_file)
            StreamlitUtils.st_markdown(st, content)

        # Sanity check
        # st.write(st.session_state)


Documentation().run()
