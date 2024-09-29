import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import threading

from common.python.agent.ai_utils import AIUtils
from common.python.utils import Utils

class FileChangeHandler(FileSystemEventHandler):
    
    # we have this flag so we can disable the file watching when we know we're the ones changing the file
    active = True
    
    def __init__(self, ext_set, cfg):
        self.ext_set = ext_set
        self.cfg = cfg
         
    def on_modified(self, event):
        if not event.is_directory:
            if self.active and Utils.has_included_file_extension(self.ext_set, event.src_path):
                # todo-0: finish this: and Utils.has_included_folder(self.folders_to_include, short_dir)):
                print(f"File Changed: {event.src_path}")
                try :
                    self.active = True
                    AIUtils.ask_agent(True, self.cfg, self.ext_set)
                except Exception as e:
                    print(f"Error: {e}")
                finally:
                    self.active = False

class FolderMonitor:
    def __init__(self, ext_set, cfg):
        self.ext_set = ext_set
        self.cfg = cfg
        self.observer = Observer()
        self.stop_event = threading.Event()

    def start(self):
        event_handler = FileChangeHandler(self.ext_set, self.cfg)   
        self.observer.schedule(event_handler, self.cfg.source_folder, recursive=True)
        self.observer.start()
        
        monitor_thread = threading.Thread(target=self._run)
        monitor_thread.start()
        print(f"Monitoring Folder: {self.cfg.source_folder}")

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

