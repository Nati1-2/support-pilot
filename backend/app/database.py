import os
import json
import asyncio
import copy
import uuid
from typing import Dict, List, Any, Optional
from datetime import datetime
from backend.app.config import settings

class MockCursor:
    def __init__(self, items: List[Dict[str, Any]]):
        self._items = items
        self._skip_count = 0
        self._limit_count = None
        self._sort_key = None
        self._sort_direction = 1

    def sort(self, key_or_list, direction=1):
        if isinstance(key_or_list, list):
            if len(key_or_list) > 0:
                self._sort_key = key_or_list[0][0]
                self._sort_direction = key_or_list[0][1]
        else:
            self._sort_key = key_or_list
            self._sort_direction = direction
        return self

    def skip(self, count: int):
        self._skip_count = count
        return self

    def limit(self, count: int):
        self._limit_count = count
        return self

    async def to_list(self, length: Optional[int] = None) -> List[Dict[str, Any]]:
        result = copy.deepcopy(self._items)
        if self._sort_key:
            reverse = self._sort_direction == -1
            def sort_val(x):
                val = x.get(self._sort_key)
                if val is None:
                    return ""
                if isinstance(val, datetime):
                    return val.isoformat()
                if isinstance(val, (int, float)):
                    return f"{val:030.10f}"
                if not isinstance(val, str):
                    return str(val)
                return val
            result.sort(key=sort_val, reverse=reverse)

        if self._skip_count:
            result = result[self._skip_count:]

        limit = length if length is not None else self._limit_count
        if limit is not None:
            result = result[:limit]

        return result

    def __aiter__(self):
        self._iter = None
        return self

    async def __anext__(self):
        if self._iter is None:
            items = await self.to_list()
            self._iter = iter(items)
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration

class AsyncMockCollection:
    def __init__(self, name: str, parent_db):
        self.name = name
        self.parent_db = parent_db
        self.docs: Dict[str, Dict[str, Any]] = {}

    def _matches(self, doc: Dict[str, Any], query: Dict[str, Any]) -> bool:
        if not query:
            return True
        for k, v in query.items():
            if k == "$or":
                if not any(self._matches(doc, cond) for cond in v):
                    return False
                continue
            if k == "$and":
                if not all(self._matches(doc, cond) for cond in v):
                    return False
                continue
            if isinstance(v, dict):
                doc_val = doc.get(k)
                for op, op_val in v.items():
                    if op == "$eq" and doc_val != op_val:
                        return False
                    elif op == "$ne" and doc_val == op_val:
                        return False
                    elif op == "$in" and doc_val not in op_val:
                        return False
                    elif op == "$nin" and doc_val in op_val:
                        return False
                    elif op == "$gt" and (doc_val is None or doc_val <= op_val):
                        return False
                    elif op == "$gte" and (doc_val is None or doc_val < op_val):
                        return False
                    elif op == "$lt" and (doc_val is None or doc_val >= op_val):
                        return False
                    elif op == "$lte" and (doc_val is None or doc_val > op_val):
                        return False
                    elif op == "$regex":
                        import re
                        pattern = op_val
                        flags = re.IGNORECASE if v.get("$options") == "i" else 0
                        if not re.search(pattern, str(doc_val or ""), flags):
                            return False
            else:
                if doc.get(k) != v:
                    return False
        return True

    def find(self, query: Optional[Dict[str, Any]] = None) -> MockCursor:
        q = query or {}
        matched = [copy.deepcopy(doc) for doc in self.docs.values() if self._matches(doc, q)]
        return MockCursor(matched)

    async def find_one(self, query: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        cursor = self.find(query)
        items = await cursor.to_list(length=1)
        return items[0] if items else None

    async def insert_one(self, doc: Dict[str, Any]):
        doc_copy = copy.deepcopy(doc)
        if "_id" not in doc_copy:
            doc_copy["_id"] = str(uuid.uuid4())
        doc_id = str(doc_copy["_id"])
        self.docs[doc_id] = doc_copy
        self.parent_db.schedule_persist()

        class InsertResult:
            def __init__(self, inserted_id):
                self.inserted_id = inserted_id
        return InsertResult(doc_id)

    async def insert_many(self, docs: List[Dict[str, Any]]):
        inserted_ids = []
        for doc in docs:
            res = await self.insert_one(doc)
            inserted_ids.append(res.inserted_id)
        return inserted_ids

    async def update_one(self, query: Dict[str, Any], update: Dict[str, Any], upsert: bool = False):
        target = None
        for doc_id, doc in self.docs.items():
            if self._matches(doc, query):
                target = (doc_id, doc)
                break

        class UpdateResult:
            def __init__(self, matched, modified, upserted_id=None):
                self.matched_count = matched
                self.modified_count = modified
                self.upserted_id = upserted_id

        if not target:
            if upsert:
                new_doc = copy.deepcopy(query)
                if "$set" in update:
                    new_doc.update(update["$set"])
                res = await self.insert_one(new_doc)
                return UpdateResult(0, 1, res.inserted_id)
            return UpdateResult(0, 0)

        doc_id, doc = target
        modified = 0

        if "$set" in update:
            for k, v in update["$set"].items():
                doc[k] = copy.deepcopy(v)
            modified = 1

        if "$inc" in update:
            for k, v in update["$inc"].items():
                doc[k] = doc.get(k, 0) + v
            modified = 1

        if "$push" in update:
            for k, v in update["$push"].items():
                if k not in doc or not isinstance(doc[k], list):
                    doc[k] = []
                doc[k].append(copy.deepcopy(v))
            modified = 1

        self.docs[doc_id] = doc
        self.parent_db.schedule_persist()
        return UpdateResult(1, modified)

    async def update_many(self, query: Dict[str, Any], update: Dict[str, Any]):
        matched = 0
        modified = 0
        for doc_id, doc in list(self.docs.items()):
            if self._matches(doc, query):
                matched += 1
                if "$set" in update:
                    for k, v in update["$set"].items():
                        doc[k] = copy.deepcopy(v)
                if "$inc" in update:
                    for k, v in update["$inc"].items():
                        doc[k] = doc.get(k, 0) + v
                if "$push" in update:
                    for k, v in update["$push"].items():
                        if k not in doc or not isinstance(doc[k], list):
                            doc[k] = []
                        doc[k].append(copy.deepcopy(v))
                self.docs[doc_id] = doc
                modified += 1
        if modified:
            self.parent_db.schedule_persist()

        class UpdateResult:
            def __init__(self, m, mod):
                self.matched_count = m
                self.modified_count = mod
        return UpdateResult(matched, modified)

    async def delete_one(self, query: Dict[str, Any]):
        for doc_id, doc in list(self.docs.items()):
            if self._matches(doc, query):
                del self.docs[doc_id]
                self.parent_db.schedule_persist()
                class DelResult:
                    deleted_count = 1
                return DelResult()
        class DelResult0:
            deleted_count = 0
        return DelResult0()

    async def delete_many(self, query: Dict[str, Any]):
        cnt = 0
        for doc_id, doc in list(self.docs.items()):
            if self._matches(doc, query):
                del self.docs[doc_id]
                cnt += 1
        if cnt > 0:
            self.parent_db.schedule_persist()
        class DelResult:
            deleted_count = cnt
        return DelResult()

    async def count_documents(self, query: Optional[Dict[str, Any]] = None) -> int:
        cursor = self.find(query)
        items = await cursor.to_list()
        return len(items)

    async def aggregate(self, pipeline: List[Dict[str, Any]]) -> MockCursor:
        # Simple pipeline simulation for basic grouping & matching
        current = [copy.deepcopy(d) for d in self.docs.values()]
        for stage in pipeline:
            if "$match" in stage:
                current = [d for d in current if self._matches(d, stage["$match"])]
            elif "$sort" in stage:
                sort_spec = stage["$sort"]
                for k, direction in sort_spec.items():
                    current.sort(key=lambda x: x.get(k, 0), reverse=(direction == -1))
            elif "$limit" in stage:
                current = current[:stage["$limit"]]
        return MockCursor(current)

class AsyncMockMotorDatabase:
    def __init__(self, data_file: str = "backend/data/store.json"):
        self.data_file = data_file
        self.collections: Dict[str, AsyncMockCollection] = {}
        self._load()

    def get_collection(self, name: str) -> AsyncMockCollection:
        if name not in self.collections:
            self.collections[name] = AsyncMockCollection(name, self)
        return self.collections[name]

    def __getitem__(self, name: str) -> AsyncMockCollection:
        return self.get_collection(name)

    def _load(self):
        if os.path.exists(self.data_file):
            try:
                with open(self.data_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for col_name, docs_list in data.items():
                        col = self.get_collection(col_name)
                        for d in docs_list:
                            doc_id = str(d.get("_id", uuid.uuid4()))
                            d["_id"] = doc_id
                            col.docs[doc_id] = d
            except Exception as e:
                print(f"[Database] Error reading persistence file: {e}")

    def schedule_persist(self):
        try:
            os.makedirs(os.path.dirname(self.data_file), exist_ok=True)
            data = {}
            for col_name, col in self.collections.items():
                data[col_name] = list(col.docs.values())
            with open(self.data_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, default=str)
        except Exception as e:
            print(f"[Database] Error persisting data: {e}")

class DatabaseManager:
    def __init__(self):
        self.client = None
        self.db = None
        self.is_atlas = False

    async def connect(self):
        if settings.MONGODB_URI:
            try:
                from motor.motor_asyncio import AsyncIOMotorClient
                self.client = AsyncIOMotorClient(
                    settings.MONGODB_URI,
                    serverSelectionTimeoutMS=8000,
                    connectTimeoutMS=8000,
                    socketTimeoutMS=8000
                )
                # verify connection with an 8s timeout for initial TLS handshake
                await asyncio.wait_for(self.client.admin.command('ping'), timeout=8.0)
                self.db = self.client[settings.MONGODB_DB_NAME]
                self.is_atlas = True
                print("[Database] Connected successfully to MongoDB Atlas.")
                return
            except Exception as e:
                print(f"[Database] MongoDB Atlas connection failed ({type(e).__name__}: {e}). Falling back to Motor mock database.")

        # Fallback to Mock Async Motor Database
        self.db = AsyncMockMotorDatabase()
        self.is_atlas = False
        print("[Database] Operating with local AsyncMockMotorDatabase (workspace-isolated & persisted).")

    def get_collection(self, name: str):
        if self.db is None:
            self.db = AsyncMockMotorDatabase()
        if hasattr(self.db, "get_collection"):
            return self.db.get_collection(name)
        return self.db[name]

db_manager = DatabaseManager()

# Collection helpers
def get_collection(name: str):
    return db_manager.get_collection(name)

# Helper for workspace queries
def with_workspace(query: Optional[Dict[str, Any]], workspace_id: str) -> Dict[str, Any]:
    q = copy.deepcopy(query) if query else {}
    q["workspace_id"] = workspace_id
    return q
