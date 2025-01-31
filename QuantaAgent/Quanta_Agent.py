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

monitor = None

if __name__ == "__main__":
    print("Quanta Agent Starting...")
    AppConfig.init_config()
    Utils.init_logging(AppConfig.cfg.data_folder + "/quanta_agent.log")
        
    # =========================================================
    # DO NOT DELETE
    # We have removed the code that we needed the FileMonitor to run, and so for now we do not need FolderMontor, but I'm leaving it here
    # so that in the future we can easily detect file changes our coding has made, and with certainty be able to (optionally) submit a note into the 
    # chat conversation about the change, so that the agent knows to re-read the entier file, if it needs to use it again, rather than potentially
    # assume any previously read copy of the file is still up to date.
    #
    # WARNING: We must pass all these values into the FolderMonitor class because it runs a thread and so based on how Python
    #          works, it will not be able to access the AppConfig values directly.
    # monitor = FolderMonitor(AppConfig.ext_set, AppConfig.folders_to_include, AppConfig.folders_to_exclude, AppConfig.cfg)
    # monitor.start()
    # =========================================================
    
    try:
        # This is just to keep the main thread alive. 
        while True:
            time.sleep(100)
    except KeyboardInterrupt:
        # if monitor not None
        if monitor is not None:
            monitor.stop()
        
    print("Quanta Agent exiting")
    