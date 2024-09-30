import time
import os
import argparse
from typing import List, Set
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import threading

from common.python.agent.ai_utils import AIUtils
from common.python.utils import Utils

class FileChangeHandler(FileSystemEventHandler):
    
    def __init__(self, ext_set: Set[str], folders_to_include: List[str], cfg: argparse.Namespace, source_folder_len: int):
        self.ext_set = ext_set
        self.folders_to_include = folders_to_include
        self.cfg = cfg
        self.source_folder_len = source_folder_len
        
    def on_modified(self, event):
        if not FolderMonitor.active or time.time() - FolderMonitor.last_change_time < 5:
            return
        if not event.is_directory:
            dirpath = os.path.dirname(event.src_path)
            short_dir: str = dirpath[self.source_folder_len :]
            if (Utils.has_included_file_extension(self.ext_set, event.src_path)
                 and Utils.has_included_folder(self.folders_to_include, short_dir)):
                
                # if there's no query to the agent, then return
                if not AIUtils.file_contains_line(event.src_path, "ok hal"):
                    return
                
                print(f"File Changed: {event.src_path}")
                try:
                    FolderMonitor.active = False
                    AIUtils.ask_agent(self.cfg, self.ext_set, self.folders_to_include)
                except Exception as e:
                    print(f"Error: {e}")
                finally:
                    FolderMonitor.last_change_time = time.time()
                    FolderMonitor.active = True

class FolderMonitor:
    active = True
    last_change_time = 0.0
    
    def __init__(self, ext_set: Set[str], folders_to_include: List[str], cfg: argparse.Namespace, source_folder_len: int):
        self.ext_set = ext_set
        self.folders_to_include = folders_to_include
        print(f"Including SubFolders: {self.folders_to_include}")
        
        self.cfg = cfg
        self.source_folder_len = source_folder_len
        self.observer = Observer()
        self.stop_event = threading.Event()

    def start(self):
        event_handler = FileChangeHandler(self.ext_set, self.folders_to_include, self.cfg, self.source_folder_len)   
        self.observer.schedule(event_handler, self.cfg.source_folder, recursive=True)
        self.observer.start()
        
        monitor_thread = threading.Thread(target=self._run)
        monitor_thread.start()
        print(f"Monitoring Root Folder: {self.cfg.source_folder}")

    def _run(self):
        try:
            while not self.stop_event.is_set():
                time.sleep(1)
        finally:
            self.observer.stop()
            self.observer.join()

    def stop(self):
        self.stop_event.set()
        self.observer.stop()
        print("Monitoring stopped")

