from passlib.context import CryptContext
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from datetime import datetime, timedelta
import os
from models import User
from database import sessionLocal

load_dotenv()

pwd_context = CryptContext(schemes=["bcrypt"])

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(password: str, hashed: str):
    return pwd_context.verify(password, hashed)

def get_db():
    db = sessionLocal()
    try:
        yield db
    finally:
        db.close()

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

def create_token(email: str):
    expire = datetime.utcnow() + timedelta(days=7)
    return jwt.encode({"sub": email, "exp": expire}, SECRET_KEY, algorithm="HS256")

def get_current_user(token: str, db: Session = Depends(get_db)):
    try:
        print(f"🔑 Received token: {token[:20]}...")
        
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        email = payload.get("sub")
        print(f"🔍 Decoded email from token: '{email}'")
        print(f"🔍 Email type: {type(email)}")
        
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            print(f"❌ User not found with email: '{email}'")
            all_users = db.query(User).all()
            print(f"📋 All users in DB:")
            for u in all_users:
                print(f"   - name: '{u.name}', email: '{u.email}', has github_token: {u.github_token is not None}")
            raise HTTPException(status_code=401, detail="User not found")
        
        print(f"✅ Found user: '{user.name}', email: '{user.email}', has github_token: {user.github_token is not None}")
        
        # ✅ REMOVED THE GITHUB TOKEN CHECK - Google users don't need it!
        # GitHub token check should only happen in endpoints that need GitHub access
            
        return user
        
    except JWTError as e:
        print(f"❌ JWT Error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Unexpected error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

# Optional: Create a separate function for endpoints that DO need GitHub token
def get_current_user_with_github(token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    
    if not user.github_token:
        raise HTTPException(
            status_code=401, 
            detail="GitHub token not found. Please login with GitHub or link your GitHub account."
        )
    
    return user