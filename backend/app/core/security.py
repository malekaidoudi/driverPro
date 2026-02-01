from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from supabase import create_client, Client
from supabase import ClientOptions
from app.core.config import get_settings
from typing import Optional

security = HTTPBearer()
settings = get_settings()


def get_supabase_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_key)


def get_admin_supabase_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_key)


def get_authed_supabase_client(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Client:
    token = credentials.credentials
    options = ClientOptions(
        headers={
            "Authorization": f"Bearer {token}",
        }
    )
    return create_client(settings.supabase_url, settings.supabase_key, options)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    supabase: Client = Depends(get_supabase_client)
) -> dict:
    token = credentials.credentials
    
    try:
        response = supabase.auth.get_user(token)
        
        if not response or not response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        admin = get_admin_supabase_client()
        full_name = None
        if response.user.user_metadata:
            full_name = response.user.user_metadata.get("full_name")

        try:
            admin.table("users").upsert(
                {
                    "id": response.user.id,
                    "email": response.user.email,
                    "full_name": full_name,
                },
                on_conflict="id",
            ).execute()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to sync user profile: {str(e)}",
            )

        return {
            "id": response.user.id,
            "email": response.user.email,
            "user_metadata": response.user.user_metadata,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def verify_user_owns_route(user_id: str, route_user_id: str) -> bool:
    if user_id != route_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this route"
        )
    return True
