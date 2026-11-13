import hashlib
import json
from datetime import datetime
from typing import Any, Dict, Optional

from backend.app.database import get_collection


class IdempotencyService:
    def _record_id(self, workspace_id: str, operation: str, key: str) -> str:
        raw = f"{workspace_id}:{operation}:{key}".encode("utf-8")
        return f"idem_{hashlib.sha256(raw).hexdigest()}"

    async def get(
        self, workspace_id: str, operation: str, key: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        if not key:
            return None
        record = await get_collection("idempotency_keys").find_one(
            {"_id": self._record_id(workspace_id, operation, key), "workspace_id": workspace_id}
        )
        return record.get("response") if record else None

    async def store(
        self,
        workspace_id: str,
        operation: str,
        key: str,
        request_payload: Dict[str, Any],
        response: Dict[str, Any],
    ) -> None:
        record_id = self._record_id(workspace_id, operation, key)
        fingerprint = hashlib.sha256(
            json.dumps(request_payload, sort_keys=True, default=str).encode("utf-8")
        ).hexdigest()
        await get_collection("idempotency_keys").update_one(
            {"_id": record_id, "workspace_id": workspace_id},
            {
                "$set": {
                    "operation": operation,
                    "key": key,
                    "request_fingerprint": fingerprint,
                    "response": response,
                    "completed_at": datetime.utcnow(),
                }
            },
            upsert=True,
        )


idempotency_service = IdempotencyService()
