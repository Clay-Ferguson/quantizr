import time
import os
from common.python.agent.models import FileSources
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import threading

from common.python.agent.project_loader import ProjectLoader
from common.python.utils import Utils

class FileChangeHandler(FileSystemEventHandler):
    
    def __init__(self, file_sources: FileSources):
        self.file_sources = file_sources
        
    def on_modified(self, event):
        if not FolderMonitor.active or time.time() - FolderMonitor.last_change_time < 5:
            return
        if not event.is_directory:
            dirpath: str = str(os.path.dirname(event.src_path))
            short_dir: str = dirpath[len(self.file_sources.source_folder) :]
            src_path: str = str(event.src_path)
            if (Utils.has_included_file_extension(self.file_sources.ext_set, src_path)
                 and Utils.allow_folder(self.file_sources.folders_to_include, self.file_sources.folders_to_exclude, short_dir)):
                
                print(f"File Changed: {event.src_path}")
                try:
                    FolderMonitor.active = False
                    ProjectLoader.get_instance(self.file_sources).on_file_changed(src_path)
                        
                except Exception as e:
                    print(f"Error: {e}")
                finally:
                    FolderMonitor.last_change_time = time.time()
                    FolderMonitor.active = True

class FolderMonitor:
    active = True
    last_change_time = 0.0
    _instance = None
    _initialized = False
    
    def __new__(cls, file_sources: FileSources):
        if cls._instance is None:
            cls._instance = super(FolderMonitor, cls).__new__(cls)
        return cls._instance
    
    def __init__(self, file_sources: FileSources):
        # Only initialize once
        if FolderMonitor._initialized:
            return
            
        if file_sources is None:
            raise ValueError("file_sources must be provided when first initializing FolderMonitor")
            
        self.file_sources = file_sources
        print(f"Including SubFolders: {self.file_sources.folders_to_include}")
        print(f"Excluding SubFolders: {self.file_sources.folders_to_exclude}") 
        self.observer = Observer()
        self.stop_event = threading.Event()
        FolderMonitor._initialized = True

    # This class is a singleton that we access thru this method
    @classmethod
    def get_instance(cls, file_sources: FileSources):
        if cls._instance is None:
            if file_sources is None:
                raise ValueError("file_sources must be provided when first initializing FolderMonitor")
            return cls(file_sources)
        
        # Check if provided file_sources is different from the existing one
        if file_sources is not None and not file_sources == cls._instance.file_sources:
            raise ValueError("FolderMonitor already initialized with different FileSources. Cannot change configuration.")
            
        return cls._instance

    def start(self):
        event_handler = FileChangeHandler(self.file_sources)   
        self.observer.schedule(event_handler, self.file_sources.source_folder, recursive=True)
        self.observer.start()
        
        monitor_thread = threading.Thread(target=self._run)
        monitor_thread.start()
        print(f"Monitoring Root Folder: {self.file_sources.source_folder}")

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

