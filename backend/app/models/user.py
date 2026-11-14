from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    email: str
    full_name: str
    role: str = "customer"  # admin, agent, viewer, customer
    workspace_id: str
    customer_id: Optional[str] = None

class UserCreate(BaseModel):
    email: str
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=1, max_length=120)

class UserLogin(BaseModel):
    email: str
    password: str

class UserInDB(UserBase):
    id: str = Field(alias="_id")
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class UserOut(UserBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
