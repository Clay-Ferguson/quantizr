"""Settings page."""

import streamlit as st
import argparse
from app_utils import AppUtils
from app_config import AppConfig


class Settings:
    """Settings page."""

    def __init__(self):
        self.cfg = AppConfig.get_config(None)

    def get_config_markdown(self, cfg: argparse.Namespace):
        """Get the config markdown."""
        return f"""
### Configuration
* Source Folder: {cfg.source_folder}
* Data Folder: {cfg.data_folder}
* Extensiont to include: {cfg.scan_extensions}
* Default Update Mode: {cfg.mode}
"""

    def run(self):
        """Run the settings page."""
        AppUtils.setup_page(st, self.cfg, "Quanta: Agent Settings")

        # ith st.expander("Show Configs"):
        cm = self.get_config_markdown(self.cfg)
        st.markdown(cm)

    # Sanity check
    # st.write(st.session_state)


Settings().run()
