import hashlib
import json
from pathlib import Path
from typing import Dict, Any, Optional


class FileCache:
    """Manages SHA256 file hash cache to optimize repository analysis performance."""

    def __init__(self, cache_file_path: str):
        self.cache_file_path = Path(cache_file_path)
        self.cache_data: Dict[str, Dict[str, Any]] = self._load()

    def _load(self) -> Dict[str, Dict[str, Any]]:
        if self.cache_file_path.exists():
            try:
                with open(self.cache_file_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def save(self):
        try:
            self.cache_file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.cache_file_path, "w", encoding="utf-8") as f:
                json.dump(self.cache_data, f, indent=2)
        except Exception:
            pass

    @staticmethod
    def get_file_hash(file_path: str) -> Optional[str]:
        path = Path(file_path)
        if not path.is_file():
            return None
        try:
            hasher = hashlib.sha256()
            with open(path, "rb") as f:
                while chunk := f.read(65536):
                    hasher.update(chunk)
            return hasher.hexdigest()
        except Exception:
            return None

    def is_file_changed(self, file_path: str) -> bool:
        current_hash = self.get_file_hash(file_path)
        if not current_hash:
            return True
        cached = self.cache_data.get(str(file_path))
        if cached and cached.get("hash") == current_hash:
            return False
        return True

    def set_cached_analysis(self, file_path: str, analysis: Dict[str, Any]):
        current_hash = self.get_file_hash(file_path)
        if current_hash:
            self.cache_data[str(file_path)] = {
                "hash": current_hash,
                "analysis": analysis,
            }
            self.save()

    def get_cached_analysis(self, file_path: str) -> Optional[Dict[str, Any]]:
        if not self.is_file_changed(file_path):
            return self.cache_data.get(str(file_path), {}).get("analysis")
        return None
