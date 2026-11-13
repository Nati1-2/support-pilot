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

    ws_id = user_in.workspace_id or settings.DEFAULT_WORKSPACE_ID

    # If custom workspace requested and not the default AeroWear workspace
    if user_in.workspace_name and not user_in.workspace_id and user_in.workspace_name.strip().lower() not in ("aerowear goods", "aerowear goods (production)", "aerowear"):
        ws_id = f"ws_{uuid.uuid4().hex[:8]}"
        ws_col = get_collection("workspaces")
        await ws_col.insert_one({
            "_id": ws_id,
            "name": user_in.workspace_name.strip(),
            "slug": user_in.workspace_name.lower().replace(" ", "-"),
            "settings": {
                "confidence_threshold": settings.CONFIDENCE_THRESHOLD,
                "store_credit_max_cap": settings.STORE_CREDIT_MAX_CAP,
                "auto_pilot_enabled": True,
                "delay_compensation_credit": 15.0,
                "gemini_model": "gemini-2.5-flash",
                "simulated_carrier": "FedEx Express"
            },
            "created_at": datetime.utcnow()
        })
        # Copy standard policies to the new workspace so RAG and guardrails are operational
        policies_col = get_collection("policy_sections")
        default_policies = await policies_col.find({"workspace_id": settings.DEFAULT_WORKSPACE_ID}).to_list(100)
        for p in default_policies:
            p_copy = dict(p)
            p_copy["_id"] = f"pol_{uuid.uuid4().hex[:8]}"
            p_copy["workspace_id"] = ws_id
            await policies_col.insert_one(p_copy)

    user_id = f"usr_{uuid.uuid4().hex[:8]}"
    requested_role = user_in.role if user_in.role in ("agent", "customer") else "agent"
    new_user = {
        "_id": user_id,
        "email": user_in.email,
        "full_name": user_in.full_name,
        "role": requested_role,
        "workspace_id": ws_id,
        "hashed_password": hash_password(user_in.password),
        "created_at": datetime.utcnow()
    }
    await users_col.insert_one(new_user)

    token = create_access_token({"sub": user_id, "email": user_in.email, "workspace_id": ws_id})
    user_out = UserOut(
        id=user_id,
        email=user_in.email,
        full_name=user_in.full_name,
        role=new_user["role"],
        workspace_id=ws_id,
        customer_id=new_user.get("customer_id"),
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
        role=user.get("role", "agent"),
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
        role=user.get("role", "agent"),
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
        role=current_user.get("role", "agent"),
        workspace_id=current_user.get("workspace_id", settings.DEFAULT_WORKSPACE_ID),
        customer_id=current_user.get("customer_id"),
        created_at=current_user.get("created_at", datetime.utcnow())
    )
