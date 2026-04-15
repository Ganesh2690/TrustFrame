"""
Storage abstraction layer.

LocalStorage is the default backend for the POC.  Swap in an S3/GCS
implementation later by implementing the same interface.
"""
import hashlib
import os
import uuid
from typing import Tuple

import aiofiles
from fastapi import UploadFile


class LocalStorage:
    def __init__(self, upload_dir: str, max_size_mb: int = 500):
        self.upload_dir = upload_dir
        self.max_size_bytes = max_size_mb * 1024 * 1024
        os.makedirs(upload_dir, exist_ok=True)

    def _subfolder(self, mime_type: str) -> str:
        """Return 'images' or 'videos' based on MIME type."""
        if mime_type.startswith("video/"):
            return "videos"
        return "images"

    async def save(self, file: UploadFile, mime_type: str = "") -> Tuple[str, str, int]:
        """
        Stream-save the uploaded file to disk while computing a SHA-256 hash.
        Files are stored in uploads/images/ or uploads/videos/ based on MIME type.

        Returns (storage_path, sha256_hex, file_size_bytes).
        Raises ValueError if the file exceeds the configured size limit.
        """
        ext = os.path.splitext(file.filename or "upload")[1].lower()
        subfolder = self._subfolder(mime_type or file.content_type or "")
        subdir = os.path.join(self.upload_dir, subfolder)
        os.makedirs(subdir, exist_ok=True)
        unique_name = f"{subfolder}/{uuid.uuid4()}{ext}"
        abs_path = os.path.join(self.upload_dir, unique_name)

        sha256 = hashlib.sha256()
        total_size = 0

        async with aiofiles.open(abs_path, "wb") as f:
            while True:
                chunk = await file.read(65536)  # 64 KB chunks
                if not chunk:
                    break
                if total_size + len(chunk) > self.max_size_bytes:
                    await f.close()
                    os.unlink(abs_path)
                    raise ValueError(
                        f"File exceeds maximum allowed size of {self.max_size_bytes // (1024*1024)} MB"
                    )
                await f.write(chunk)
                sha256.update(chunk)
                total_size += len(chunk)

        return unique_name, sha256.hexdigest(), total_size

    def get_url(self, storage_path: str) -> str:
        """Return a URL path that can be served via the /static/uploads mount."""
        return f"/static/uploads/{storage_path}"

    def delete(self, storage_path: str) -> None:
        abs_path = os.path.join(self.upload_dir, storage_path)
        if os.path.exists(abs_path):
            os.unlink(abs_path)
