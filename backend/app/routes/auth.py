import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from backend.app.database import get_collection
from backend.app.models.user import UserCreate, UserLogin, TokenResponse, UserOut
from backend.app.services.auth_service import hash_password, verify_password, create_access_token, get_current_user
from backend.app.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=TokenResponse)
async def register(user_in: UserCreate):
    users_col = get_collection("users")
    existing = await users_col.find_one({"email": user_in.email})
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    # Public registration is intentionally least-privileged. Roles and workspace
    # membership are server-controlled and cannot be selected by the request.
    ws_id = settings.DEFAULT_WORKSPACE_ID
    user_id = f"usr_{uuid.uuid4().hex[:8]}"
    customer_id = f"cust_{uuid.uuid4().hex[:8]}"
    created_at = datetime.utcnow()

    await get_collection("customers").insert_one({
        "_id": customer_id,
        "workspace_id": ws_id,
        "name": user_in.full_name.strip(),
        "email": user_in.email,
        "phone": None,
        "total_spent": 0.0,
        "orders_count": 0,
        "average_order_value": 0.0,
        "sentiment_score": 0.5,
        "is_vip": False,
        "tags": ["registered_user"],
        "notes": None,
        "created_at": created_at,
    })

    new_user = {
        "_id": user_id,
        "email": user_in.email,
        "full_name": user_in.full_name.strip(),
        "role": "customer",
        "workspace_id": ws_id,
        "customer_id": customer_id,
        "hashed_password": hash_password(user_in.password),
        "created_at": created_at,
    }
    await users_col.insert_one(new_user)

    token = create_access_token({"sub": user_id, "email": user_in.email, "workspace_id": ws_id})
    user_out = UserOut(
        id=user_id,
        email=user_in.email,
        full_name=new_user["full_name"],
        role=new_user["role"],
        workspace_id=ws_id,
        customer_id=customer_id,
        created_at=new_user["created_at"]
    )
    return TokenResponse(access_token=token, token_type="bearer", user=user_out)

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    users_col = get_collection("users")
    user = await users_col.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user.get("hashed_password", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user["_id"])
    token = create_access_token({"sub": user_id, "email": user["email"], "workspace_id": user.get("workspace_id", settings.DEFAULT_WORKSPACE_ID)})

    user_out = UserOut(
        id=user_id,
        email=user["email"],
        full_name=user["full_name"],
        role=user.get("role", "customer"),
        workspace_id=user.get("workspace_id", settings.DEFAULT_WORKSPACE_ID),
        customer_id=user.get("customer_id"),
        created_at=user.get("created_at", datetime.utcnow())
    )
    return TokenResponse(access_token=token, token_type="bearer", user=user_out)

@router.post("/demo/{role}", response_model=TokenResponse)
async def demo_login(role: str):
    role_email_map = {
        "admin": "admin@aerowear.com",
        "agent": "sarah.support@aerowear.com",
        "viewer": "viewer@aerowear.com",
        "customer": "customer@aerowear.com",
    }
    target_email = role_email_map.get(role.lower())
    if not target_email:
        raise HTTPException(status_code=400, detail=f"Unknown demo role '{role}'. Choose admin, agent, viewer, or customer.")

    users_col = get_collection("users")
    user = await users_col.find_one({"email": target_email})
    if not user:
        raise HTTPException(status_code=404, detail="Demo user account not found in database")

    user_id = str(user["_id"])
    token = create_access_token({"sub": user_id, "email": user["email"], "workspace_id": user.get("workspace_id", settings.DEFAULT_WORKSPACE_ID)})
    user_out = UserOut(
        id=user_id,
        email=user["email"],
        full_name=user["full_name"],
        role=user.get("role", "customer"),
        workspace_id=user.get("workspace_id", settings.DEFAULT_WORKSPACE_ID),
        customer_id=user.get("customer_id"),
        created_at=user.get("created_at", datetime.utcnow())
    )
    return TokenResponse(access_token=token, token_type="bearer", user=user_out)

@router.get("/me", response_model=UserOut)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserOut(
        id=str(current_user["_id"]),
        email=current_user["email"],
        full_name=current_user["full_name"],
        role=current_user.get("role", "customer"),
        workspace_id=current_user.get("workspace_id", settings.DEFAULT_WORKSPACE_ID),
        customer_id=current_user.get("customer_id"),
        created_at=current_user.get("created_at", datetime.utcnow())
    )
