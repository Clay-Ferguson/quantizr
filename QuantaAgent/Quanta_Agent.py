"""Runs the Agent"""

import sys
import os
import time

ABS_FILE = os.path.abspath(__file__)
PRJ_DIR = os.path.dirname(os.path.dirname(ABS_FILE))
sys.path.append(PRJ_DIR)

from app_config import AppConfig
from common.python.utils import Utils
from common.python.agent.folder_monitor import FolderMonitor

if __name__ == "__main__":
    print("Quanta Agent Starting...")
    AppConfig.init_config()
    Utils.init_logging(AppConfig.cfg.data_folder + "/quanta_agent.log")
        
    monitor = FolderMonitor(AppConfig.ext_set, AppConfig.folders_to_include, AppConfig.cfg, AppConfig.source_folder_len)
    monitor.start()
    
    try:
        # This is just to keep the main thread alive. 
        while True:
            time.sleep(100)
    except KeyboardInterrupt:
        monitor.stop()
        
    print("Quanta Agent exiting")
    