from fastapi import FastAPI, Request, Depends, HTTPException
from sqlalchemy.orm import Session
from models import User, Project, ProjectMember, AIProjectContext, CommitExplanation, AIChatHistory
from database import sessionLocal
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from auth import create_token, get_current_user
from dotenv import load_dotenv
import httpx
import requests
from datetime import datetime
from groq import Groq
from pydantic import BaseModel
from typing import Optional, List

load_dotenv()
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq client
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def get_db():
    db = sessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==================== AUTH ENDPOINTS ====================

@app.post("/auth/google")
async def google_auth(request: dict, db: Session = Depends(get_db)):
    email = request.get("email")
    
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email)
        db.add(user)
        db.commit()
    
    token = create_token(email)
    is_new_user = user.role == "pending"
    return {"token": token, "is_new_user": is_new_user}


# Add this to your FastAPI backend

# Update the /auth/me endpoint to accept token in request body

class TokenOnlyRequest(BaseModel):
    token: str


@app.post("/auth/me")
async def get_me_post(req: TokenOnlyRequest, db: Session = Depends(get_db)):
    """Get current user info including role"""
    user = get_current_user(req.token, db)
    return {
        "email": user.email, 
        "name": user.name, 
        "role": user.role,  # Important: return the role
        "picture": user.picture
    }


# If your existing /auth/me is GET, keep it and add this POST version
# Or modify the existing one to work with both GET and POST

@app.get("/auth/github/login")
async def github_login():
    github_url = (
        f"https://github.com/login/oauth/authorize?"
        f"client_id={os.getenv('GITHUB_CLIENT_ID')}&"
        f"redirect_uri=https://codetrack-10l2.onrender.com/login&"
        f"scope=repo user:email"
    )
    return {"url": github_url}


@app.post("/auth/github")
async def github_auth(request: dict, db: Session = Depends(get_db)):
    code = request.get("code")
    
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": os.getenv("GITHUB_CLIENT_ID"),
                "client_secret": os.getenv("GITHUB_CLIENT_SECRET"),
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
        
        token_data = token_response.json()
        github_access_token = token_data.get("access_token")
        
        if not github_access_token:
            error_msg = token_data.get("error_description", token_data.get("error", "Unknown error"))
            raise HTTPException(status_code=400, detail=f"GitHub error: {error_msg}")
        
        user_response = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {github_access_token}"},
        )
        
        user_data = user_response.json()
        github_username = user_data.get("login")
        
        email_response = await client.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"Bearer {github_access_token}"},
        )
        
        emails = email_response.json()
        primary_email = None
        
        if isinstance(emails, list) and len(emails) > 0:
            for email_obj in emails:
                if isinstance(email_obj, dict) and email_obj.get("primary"):
                    primary_email = email_obj.get("email")
                    break
        
        if not primary_email:
            raise HTTPException(status_code=400, detail="No primary email found")
    
    user = db.query(User).filter(User.email == primary_email).first()
    if not user:
        user = User(
            email=primary_email,
            github_name=github_username,
            github_token=github_access_token
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.github_name = github_username
        user.github_token = github_access_token
        db.commit()
    
    token = create_token(primary_email)
    is_new_user = user.role == "pending"
    return {"token": token, "is_new_user": is_new_user, "user": {"email": primary_email, "github_username": github_username}}

class SemiAuthRequest(BaseModel):
    name: str
    role: str
    token: str


@app.post("/semiauth")
def semiauth(things: SemiAuthRequest, db: Session = Depends(get_db)):
    try:
        user = get_current_user(things.token, db)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user.name = things.name
        user.role = things.role
        db.commit()
        db.refresh(user)
        return {"success": True, "message": "Profile updated successfully"}
    except Exception as e:
        print(f"Error in semiauth: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


# ==================== PROJECT CREATION ====================

class CreateProjectRequest(BaseModel):
    token: str
    name: str
    description: str
    repo_name: str
    repo_url: str
    project_type: Optional[str] = None
    required_features: Optional[str] = None
    deadline: Optional[str] = None
    special_requirements: Optional[str] = None
    budget: Optional[int] = None
    technical_stack: Optional[str] = None


@app.post("/createproject")
async def createproject(pro: CreateProjectRequest, db: Session = Depends(get_db)):
    user = get_current_user(pro.token, db)
    
    # Create project (repo can be null)
    new_project = Project(
        name=pro.name,
        description=pro.description,
        owner_id=user.id,
        is_linked=bool(pro.repo_url),  # Only True if repo provided
        repo_url=pro.repo_url,
        repo_name=pro.repo_name,
    )
    
    db.add(new_project)
    db.flush()
    
    # Add creator as member
    db.add(ProjectMember(
        project_id=new_project.id,
        user_id=user.id,
        member_role=user.role,
    ))
    
    # Create AI context
    ai_context = AIProjectContext(
        project_id=new_project.id,
        project_type=pro.project_type or pro.description,
        required_features=pro.required_features,
        deadline=datetime.fromisoformat(pro.deadline) if pro.deadline else None,
        special_requirements=pro.special_requirements,
        budget=pro.budget,
        technical_stack=pro.technical_stack,
    )
    
    db.add(ai_context)
    db.commit()
    
    # Only analyze if repo is linked
    if pro.repo_url and pro.repo_name:
        try:
            await analyze_repository_initial(new_project.id, user, db)
        except Exception as e:
            print(f"Error analyzing repository: {str(e)}")
    
    return {"success": True, "project_id": new_project.id}

async def analyze_repository_initial(project_id: int, user: User, db: Session):
    """Initial AI analysis of repository"""
    project = db.query(Project).filter(Project.id == project_id).first()
    ai_context = db.query(AIProjectContext).filter(AIProjectContext.project_id == project_id).first()
    
    # Fetch commits from GitHub
    headers = {
        'Authorization': f'token {user.github_token}',
        'Accept': 'application/vnd.github.v3+json'
    }
    
    commits_url = f'https://api.github.com/repos/{user.github_name}/{project.repo_name}/commits'
    response = requests.get(commits_url, headers=headers, params={"per_page": 100})
    
    if response.status_code != 200:
        print(f"Failed to fetch commits: {response.status_code}")
        return
    
    commits = response.json()
    commit_messages = [c['commit']['message'] for c in commits[:50]]
    
    # Ask AI to analyze - Use a more structured prompt
    prompt = f"""Analyze this software project and provide ONLY the requested information in the exact format shown:

PROJECT NAME: {project.name}
DESCRIPTION: {project.description}
REQUIRED FEATURES: {ai_context.required_features or 'Not specified'}
TECHNICAL STACK: {ai_context.technical_stack or 'Unknown'}

COMMIT HISTORY (last 50 commits):
{chr(10).join(commit_messages)}

Respond ONLY in this exact format (one line per field):
UNDERSTANDING: [1-2 sentence summary of what has been built]
TIMELINE: [Estimate in format: "X weeks" or "Y days"]
COMPLEXITY: [Number from 1-10]
PROGRESS: [Number from 0-100 only, no % symbol]
COMPLETED: [Comma-separated list of completed features]
PENDING: [Comma-separated list of pending features]

Example response:
UNDERSTANDING: A task management web application with user authentication and real-time updates.
TIMELINE: 3 weeks
COMPLEXITY: 7
PROGRESS: 35
COMPLETED: User login, database setup, basic UI
PENDING: Real-time notifications, payment integration, admin dashboard"""

    try:
        response = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a senior software architect. Respond ONLY in the exact format requested. Be concise and accurate."},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.3,  # Lower temperature for more consistent formatting
            max_tokens=500
        )
        
        analysis = response.choices[0].message.content
        print(f"\n📊 AI Analysis Response:\n{analysis}\n")
        
        # Parse AI response with better error handling
        lines = analysis.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            if line.startswith('UNDERSTANDING:'):
                ai_context.ai_understanding = line.replace('UNDERSTANDING:', '').strip()
                print(f"✓ Understanding: {ai_context.ai_understanding}")
                
            elif line.startswith('TIMELINE:'):
                ai_context.estimated_timeline = line.replace('TIMELINE:', '').strip()
                print(f"✓ Timeline: {ai_context.estimated_timeline}")
                
            elif line.startswith('COMPLEXITY:'):
                try:
                    complexity_str = line.replace('COMPLEXITY:', '').strip()
                    # Extract first number found
                    import re
                    match = re.search(r'\d+\.?\d*', complexity_str)
                    if match:
                        ai_context.complexity_score = float(match.group())
                        print(f"✓ Complexity: {ai_context.complexity_score}")
                except Exception as e:
                    print(f"⚠️ Error parsing complexity: {e}")
                    ai_context.complexity_score = 5.0
                    
            elif line.startswith('PROGRESS:'):
                try:
                    progress_str = line.replace('PROGRESS:', '').strip()
                    # Remove % symbol if present and extract number
                    import re
                    match = re.search(r'\d+', progress_str)
                    if match:
                        progress_value = int(match.group())
                        # Ensure it's between 0-100
                        ai_context.current_progress = max(0, min(100, progress_value))
                        print(f"✓ Progress: {ai_context.current_progress}%")
                    else:
                        print(f"⚠️ No number found in progress: {progress_str}")
                        ai_context.current_progress = 0
                except Exception as e:
                    print(f"⚠️ Error parsing progress: {e}")
                    ai_context.current_progress = 0
                    
            elif line.startswith('COMPLETED:'):
                ai_context.completed_features = line.replace('COMPLETED:', '').strip()
                print(f"✓ Completed: {ai_context.completed_features}")
                
            elif line.startswith('PENDING:'):
                ai_context.pending_features = line.replace('PENDING:', '').strip()
                print(f"✓ Pending: {ai_context.pending_features}")
        
        # Set default progress if still 0 and there are commits
        if ai_context.current_progress == 0 and len(commits) > 0:
            # Estimate based on commit count
            estimated_progress = min(len(commits) * 2, 100)  # Rough estimate
            ai_context.current_progress = estimated_progress
            print(f"⚠️ Set default progress based on commits: {estimated_progress}%")
        
        ai_context.last_ai_sync = datetime.utcnow()
        db.commit()
        print("✅ AI analysis saved to database")
        
    except Exception as e:
        print(f"❌ Error in AI analysis: {str(e)}")
        import traceback
        traceback.print_exc()
# ==================== PROJECT VIEWS ====================

class TokenRequest(BaseModel):
    token: str


@app.post("/getprojects")
def getprojects(pro: TokenRequest, db: Session = Depends(get_db)):
    user = get_current_user(pro.token, db)
    memberships = db.query(ProjectMember).filter(ProjectMember.user_id == user.id).all()
    
    projects = []
    for membership in memberships:
        project = db.query(Project).filter(Project.id == membership.project_id).first()
        if project:
            ai_context = db.query(AIProjectContext).filter(AIProjectContext.project_id == project.id).first()
            projects.append({
                "id": project.id,
                "name": project.name,
                "description": project.description,
                "repo_url": project.repo_url,
                "created_at": project.created_at.isoformat(),
                "progress": ai_context.current_progress if ai_context else 0,
                "status": "on_track" if ai_context and ai_context.current_progress > 50 else "in_progress"
            })
    
    return projects


class ProjectDetailRequest(BaseModel):
    token: str
    project_id: int


@app.post("/getproject")
async def get_project(req: ProjectDetailRequest, db: Session = Depends(get_db)):
    user = get_current_user(req.token, db)
    project = db.query(Project).filter(Project.id == req.project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user is member
    membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project.id,
        ProjectMember.user_id == user.id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this project")
    
    # Get AI context
    ai_context = db.query(AIProjectContext).filter(AIProjectContext.project_id == project.id).first()
    
    # Get commits with explanations
    commit_explanations = db.query(CommitExplanation).filter(
        CommitExplanation.project_id == project.id
    ).order_by(CommitExplanation.commit_date.desc()).limit(50).all()
    
    # If no explanations yet, fetch from GitHub
    if len(commit_explanations) == 0:
        await fetch_and_explain_commits(project.id, user, db)
        commit_explanations = db.query(CommitExplanation).filter(
            CommitExplanation.project_id == project.id
        ).order_by(CommitExplanation.commit_date.desc()).limit(50).all()
    
    commits_data = []
    for exp in commit_explanations:
        commits_data.append({
            "sha": exp.commit_sha,
            "message": exp.commit_message,
            "author": exp.commit_author,
            "date": exp.commit_date.isoformat() if exp.commit_date else None,
            "ai_explanation": exp.ai_explanation,
            "ai_impact": exp.ai_impact,
            "files_changed": exp.files_changed,
            "additions": exp.additions,
            "deletions": exp.deletions,
            "is_flagged": exp.is_flagged,
            "flag_reason": exp.flag_reason
        })
    
    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "repo_url": project.repo_url,
            "repo_name": project.repo_name,
            "created_at": project.created_at.isoformat()
        },
        "ai_context": {
            "understanding": ai_context.ai_understanding if ai_context else None,
            "timeline": ai_context.estimated_timeline if ai_context else None,
            "progress": ai_context.current_progress if ai_context else 0,
            "complexity": ai_context.complexity_score if ai_context else None,
            "completed_features": ai_context.completed_features if ai_context else None,
            "pending_features": ai_context.pending_features if ai_context else None,
        },
        "commits": commits_data
    }


async def fetch_and_explain_commits(project_id: int, user: User, db: Session):
    """Fetch commits from GitHub and generate AI explanations"""
    project = db.query(Project).filter(Project.id == project_id).first()
    ai_context = db.query(AIProjectContext).filter(AIProjectContext.project_id == project_id).first()
    
    headers = {
        'Authorization': f'token {user.github_token}',
        'Accept': 'application/vnd.github.v3+json'
    }
    
    commits_url = f'https://api.github.com/repos/{user.github_name}/{project.repo_name}/commits'
    response = requests.get(commits_url, headers=headers, params={"per_page": 30})
    
    if response.status_code != 200:
        print(f"Failed to fetch commits: {response.status_code}")
        return
    
    commits = response.json()
    total_progress_delta = 0
    new_commits_count = 0
    
    for commit_data in commits:
        # Check if already explained
        existing = db.query(CommitExplanation).filter(
            CommitExplanation.commit_sha == commit_data['sha']
        ).first()
        
        if existing:
            continue
        
        new_commits_count += 1
        
        # Get detailed commit info
        commit_detail_url = f"https://api.github.com/repos/{user.github_name}/{project.repo_name}/commits/{commit_data['sha']}"
        detail_response = requests.get(commit_detail_url, headers=headers)
        
        if detail_response.status_code != 200:
            continue
        
        detail = detail_response.json()
        
        # Generate AI explanation
        prompt = f"""Explain this code commit to a non-technical client.

PROJECT: {project.name}
DESCRIPTION: {project.description}
PROJECT GOAL: {ai_context.required_features if ai_context else 'General development'}

COMMIT MESSAGE: {commit_data['commit']['message']}
AUTHOR: {commit_data['commit']['author']['name']}
FILES CHANGED: {detail['stats']['total']} files
LINES ADDED: +{detail['stats']['additions']}
LINES REMOVED: -{detail['stats']['deletions']}

Provide in this EXACT format:
EXPLANATION: [2-3 sentences in simple terms explaining what was done]
IMPACT: [Why this matters for the project - 1 sentence]
PROGRESS: [How much closer to completion: number between 1-10]

Example:
EXPLANATION: Added user login functionality allowing users to create accounts and securely log in. Implemented password hashing for security.
IMPACT: This is a core feature needed for the application and allows user data to be protected.
PROGRESS: 5"""

        try:
            ai_response = groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You explain technical work to non-technical people clearly and simply. Be concise and follow the format exactly."},
                    {"role": "user", "content": prompt}
                ],
                model="llama-3.3-70b-versatile",
                temperature=0.5,
                max_tokens=300
            )
            
            ai_text = ai_response.choices[0].message.content
            
            # Parse response
            explanation = ""
            impact = ""
            progress = 0
            
            lines = ai_text.split('\n')
            
            for line in lines:
                line = line.strip()
                if 'EXPLANATION:' in line:
                    explanation = line.replace('EXPLANATION:', '').strip()
                elif 'IMPACT:' in line:
                    impact = line.replace('IMPACT:', '').strip()
                elif 'PROGRESS:' in line:
                    try:
                        import re
                        match = re.search(r'\d+', line.replace('PROGRESS:', '').strip())
                        if match:
                            progress = int(match.group())
                            progress = max(1, min(10, progress))  # Clamp between 1-10
                    except:
                        progress = 2  # Default small progress
            
            # If parsing failed, set defaults
            if not explanation:
                explanation = f"Updated {detail['stats']['total']} files with {detail['stats']['additions']} additions"
            if not impact:
                impact = "Code improvements and updates"
            if progress == 0:
                progress = 2
            
            # Save explanation
            commit_explanation = CommitExplanation(
                project_id=project.id,
                commit_sha=commit_data['sha'],
                commit_message=commit_data['commit']['message'],
                commit_author=commit_data['commit']['author']['name'],
                commit_date=datetime.fromisoformat(commit_data['commit']['author']['date'].replace('Z', '+00:00')),
                files_changed=detail['stats']['total'],
                additions=detail['stats']['additions'],
                deletions=detail['stats']['deletions'],
                ai_explanation=explanation,
                ai_impact=impact,
                progress_delta=progress
            )
            
            db.add(commit_explanation)
            total_progress_delta += progress
            
            print(f"✓ Explained commit: {commit_data['commit']['message'][:50]}... (Progress: +{progress})")
            
        except Exception as e:
            print(f"Error explaining commit: {str(e)}")
            continue
    
    db.commit()
    
    # Update AI context with accumulated progress
    if new_commits_count > 0 and ai_context:
        # Add the progress delta (but cap at 100%)
        ai_context.current_progress = min(100, ai_context.current_progress + total_progress_delta)
        ai_context.last_ai_sync = datetime.utcnow()
        db.commit()
        print(f"📊 Updated progress: +{total_progress_delta} points ({new_commits_count} new commits)")
# ==================== AI CHAT ====================

class AskAIRequest(BaseModel):
    token: str
    project_id: int
    question: str


@app.post("/ask-ai")
async def ask_ai(req: AskAIRequest, db: Session = Depends(get_db)):
    user = get_current_user(req.token, db)
    project = db.query(Project).filter(Project.id == req.project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    ai_context = db.query(AIProjectContext).filter(AIProjectContext.project_id == project.id).first()
    
    # Get recent commits for context
    recent_commits = db.query(CommitExplanation).filter(
        CommitExplanation.project_id == project.id
    ).order_by(CommitExplanation.commit_date.desc()).limit(10).all()
    
    commits_context = "\n".join([
        f"- {c.commit_message} ({c.ai_explanation})"
        for c in recent_commits
    ])
    
    # Build context for AI
    context = f"""PROJECT: {project.name}
DESCRIPTION: {project.description}

AI UNDERSTANDING: {ai_context.ai_understanding if ai_context else 'Not analyzed yet'}
CURRENT PROGRESS: {ai_context.current_progress if ai_context else 0}%
COMPLETED FEATURES: {ai_context.completed_features if ai_context else 'None yet'}
PENDING FEATURES: {ai_context.pending_features if ai_context else 'Unknown'}

RECENT WORK:
{commits_context}

USER QUESTION: {req.question}

Answer the question helpfully, referencing specific commits or features when relevant."""

    try:
        response = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a helpful AI assistant explaining a software project to a client. Be clear, friendly, and specific."},
                {"role": "user", "content": context}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=400
        )
        
        answer = response.choices[0].message.content
        
        # Save to chat history
        chat = AIChatHistory(
            project_id=project.id,
            user_id=user.id,
            user_question=req.question,
            ai_response=answer
        )
        
        db.add(chat)
        db.commit()
        
        return {"answer": answer}
        
    except Exception as e:
        print(f"Error in AI chat: {str(e)}")
        raise HTTPException(status_code=500, detail="AI service error")


class GetChatHistoryRequest(BaseModel):
    token: str
    project_id: int


@app.post("/get-chat-history")
def get_chat_history(req: GetChatHistoryRequest, db: Session = Depends(get_db)):
    user = get_current_user(req.token, db)
    
    chats = db.query(AIChatHistory).filter(
        AIChatHistory.project_id == req.project_id
    ).order_by(AIChatHistory.created_at.asc()).all()
    
    return [{
        "id": chat.id,
        "question": chat.user_question,
        "answer": chat.ai_response,
        "created_at": chat.created_at.isoformat()
    } for chat in chats]


# ==================== REPOSITORY BROWSING ====================

class GetFoldersRequest(BaseModel):
    token: str
    path: str = ""


@app.post("/getfolders/{id}")
def getfolders(things: GetFoldersRequest, id: int, db: Session = Depends(get_db)):
    user = get_current_user(things.token, db)
    
    if not user.github_token:
        raise HTTPException(status_code=401, detail="GitHub token not found. Please login again.")
    
    headers = {
        'Authorization': f'token {user.github_token}',
        'Accept': 'application/vnd.github.v3+json'
    }
    
    url = 'https://api.github.com/user/repos'
    repos = []
    
    while url:
        response = requests.get(url, headers=headers)
        if response.status_code == 401:
            raise HTTPException(status_code=401, detail="GitHub token expired. Please login again.")
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"Error fetching repos: {response.json().get('message', 'Unknown error')}")
        
        repos.extend(response.json())
        link_header = response.headers.get('Link')
        url = None
        if link_header:
            links = link_header.split(', ')
            for link in links:
                if 'rel="next"' in link:
                    url = link.split(';')[0].strip('<> ')
                    break
    
    irepo = None
    for repo in repos:
        if id == repo['id']:
            irepo = repo
            break
    
    if not irepo:
        raise HTTPException(status_code=404, detail="Repository not found in user's repos")
    
    url = f'https://api.github.com/repos/{irepo["owner"]["login"]}/{irepo["name"]}/contents/{things.path}'
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="GitHub token expired. Please login again.")
    
    if response.status_code != 200:
        error_detail = response.json().get('message', 'Unknown error')
        raise HTTPException(status_code=response.status_code, detail=error_detail)
    
    contents = response.json()
    
    # If it's a file, return file content
    if isinstance(contents, dict) and contents.get('type') == 'file':
        import base64
        content = base64.b64decode(contents.get('content', '')).decode('utf-8')
        return {"type": "file", "name": contents['name'], "content": content}
    
    # If it's a folder, return items
    result = []
    if isinstance(contents, list):
        for item in contents:
            type_icon = "Folder" if item['type'] == 'dir' else "File"
            result.append({
                "type": type_icon,
                "name": item['name'],
                "path": item['path']
            })
    
    return result


@app.post("/getallrepos")
def getrepos(token: TokenRequest, db: Session = Depends(get_db)):
    user = get_current_user(token.token, db)
    headers = {
        'Authorization': f'token {user.github_token}',
        'Accept': 'application/vnd.github.v3+json'
    }
    url = 'https://api.github.com/user/repos'
    repos = []
    
    while url:
        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            raise Exception(f"Error: {response.status_code} - {response.json().get('message', 'Unknown error')}")
        
        repos.extend(response.json())
        link_header = response.headers.get('Link')
        url = None
        if link_header:
            links = link_header.split(', ')
            for link in links:
                if 'rel="next"' in link:
                    url = link.split(';')[0].strip('<> ')
                    break
    
    return repos


# ==================== TEAM MANAGEMENT ====================

class AddMemberRequest(BaseModel):
    name: str
    token: str
    id: int
    role: str


@app.post("/addmember")
def addMember(mem: AddMemberRequest, db: Session = Depends(get_db)):
    user = get_current_user(mem.token, db)
    member = db.query(User).filter(User.name == mem.name).first()
    
    if not member:
        raise HTTPException(status_code=404, detail="User not found")
    
    repo_access = mem.role == "freelancer"
    
    new_member = ProjectMember(
        project_id=mem.id,
        user_id=member.id,
        member_role=mem.role,
        can_link_repo=repo_access
    )
    
    db.add(new_member)
    db.commit()
    
    return {"success": True}

# Add this endpoint to your FastAPI backend (main.py or wherever your routes are)

# ==================== REFRESH COMMITS ====================

class RefreshCommitsRequest(BaseModel):
    token: str
    project_id: int


@app.post("/refresh-commits")
async def refresh_commits(req: RefreshCommitsRequest, db: Session = Depends(get_db)):
    """Manually fetch and explain new commits from GitHub"""
    user = get_current_user(req.token, db)
    project = db.query(Project).filter(Project.id == req.project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user is member
    membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project.id,
        ProjectMember.user_id == user.id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this project")
    
    # Fetch and explain new commits
    try:
        await fetch_and_explain_commits(project.id, user, db)
        
        # IMPORTANT: Re-analyze progress after fetching commits
        print("🔄 Re-analyzing project progress after commit refresh...")
        await analyze_repository_initial(project.id, user, db)
        
        # Get updated progress
        ai_context = db.query(AIProjectContext).filter(
            AIProjectContext.project_id == project.id
        ).first()
        
        new_progress = ai_context.current_progress if ai_context else 0
        print(f"✅ Updated progress: {new_progress}%")
        
        return {
            "success": True, 
            "message": "Commits refreshed and progress updated",
            "progress": new_progress
        }
    except Exception as e:
        print(f"Error refreshing commits: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to refresh commits: {str(e)}")



# Add these endpoints to your FastAPI backend

from datetime import datetime, timedelta
from typing import Optional

# ==================== CLIENT DASHBOARD ====================

class GetClientSummaryRequest(BaseModel):
    token: str
    project_id: int


@app.post("/get-client-summary")
async def get_client_summary(req: GetClientSummaryRequest, db: Session = Depends(get_db)):
    """Get a client-friendly summary of project progress"""
    user = get_current_user(req.token, db)
    project = db.query(Project).filter(Project.id == req.project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    ai_context = db.query(AIProjectContext).filter(
        AIProjectContext.project_id == project.id
    ).first()
    
    # Get commits from last 7 days
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_commits = db.query(CommitExplanation).filter(
        CommitExplanation.project_id == project.id,
        CommitExplanation.commit_date >= week_ago
    ).order_by(CommitExplanation.commit_date.desc()).all()
    
    # Calculate activity metrics
    total_commits_this_week = len(recent_commits)
    total_files_changed = sum(c.files_changed for c in recent_commits)
    total_progress_gained = sum(c.progress_delta for c in recent_commits)
    
    # Generate AI weekly summary
    if total_commits_this_week > 0:
        commits_summary = "\n".join([
            f"- {c.commit_message} ({c.ai_explanation})"
            for c in recent_commits[:10]
        ])
        
        prompt = f"""Generate a client-friendly weekly summary for this project.

PROJECT: {project.name}
PROGRESS: {ai_context.current_progress if ai_context else 0}%
COMMITS THIS WEEK: {total_commits_this_week}
FILES CHANGED: {total_files_changed}

WORK COMPLETED THIS WEEK:
{commits_summary}

Write a 2-3 sentence summary that:
1. Highlights what was accomplished
2. Mentions progress made
3. Sets expectations for next week

Keep it positive, clear, and client-friendly. No technical jargon."""

        try:
            response = groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You write clear, friendly project updates for non-technical clients."},
                    {"role": "user", "content": prompt}
                ],
                model="llama-3.3-70b-versatile",
                temperature=0.7,
                max_tokens=200
            )
            
            weekly_summary = response.choices[0].message.content
            
        except Exception as e:
            print(f"Error generating summary: {e}")
            weekly_summary = f"This week: {total_commits_this_week} updates made, {total_progress_gained}% progress gained."
    else:
        weekly_summary = "No activity this week."
    
    return {
        "project_name": project.name,
        "progress": ai_context.current_progress if ai_context else 0,
        "weekly_summary": weekly_summary,
        "commits_this_week": total_commits_this_week,
        "files_changed": total_files_changed,
        "completed_features": ai_context.completed_features if ai_context else None,
        "pending_features": ai_context.pending_features if ai_context else None,
        "estimated_timeline": ai_context.estimated_timeline if ai_context else None,
        "recent_work": [
            {
                "message": c.commit_message,
                "explanation": c.ai_explanation,
                "date": c.commit_date.isoformat() if c.commit_date else None
            }
            for c in recent_commits[:7]
        ]
    }


# ==================== EMAIL SUMMARY (OPTIONAL) ====================

@app.post("/send-weekly-summary-email")
async def send_weekly_summary_email(req: GetClientSummaryRequest, db: Session = Depends(get_db)):
    """Send weekly summary email to client"""
    # Get summary data
    summary = await get_client_summary(req, db)
    
    # TODO: Integrate with SendGrid/Mailgun to send email
    # For now, just return the email content
    
    email_html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; color: white;">
            <h1 style="margin: 0;">Weekly Project Update</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">{summary['project_name']}</p>
        </div>
        
        <div style="padding: 30px; background: #f7fafc;">
            <div style="background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
                <h2 style="color: #2d3748; margin-top: 0;">Progress: {summary['progress']}%</h2>
                <div style="background: #e2e8f0; height: 20px; border-radius: 10px; overflow: hidden;">
                    <div style="background: #667eea; height: 100%; width: {summary['progress']}%; transition: width 0.3s;"></div>
                </div>
            </div>
            
            <div style="background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
                <h3 style="color: #2d3748; margin-top: 0;">This Week's Summary</h3>
                <p style="color: #4a5568; line-height: 1.6;">{summary['weekly_summary']}</p>
                
                <div style="display: flex; gap: 20px; margin-top: 20px;">
                    <div style="flex: 1; background: #f7fafc; padding: 15px; border-radius: 8px;">
                        <div style="color: #667eea; font-size: 24px; font-weight: bold;">{summary['commits_this_week']}</div>
                        <div style="color: #718096; font-size: 14px;">Updates</div>
                    </div>
                    <div style="flex: 1; background: #f7fafc; padding: 15px; border-radius: 8px;">
                        <div style="color: #667eea; font-size: 24px; font-weight: bold;">{summary['files_changed']}</div>
                        <div style="color: #718096; font-size: 14px;">Files Changed</div>
                    </div>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
                <a href="http://yourapp.com/project/{req.project_id}" 
                   style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    View Full Details
                </a>
            </div>
        </div>
        
        <div style="background: #2d3748; padding: 20px; text-align: center; color: white;">
            <p style="margin: 0; opacity: 0.7; font-size: 12px;">
                Powered by YourSaaS | <a href="#" style="color: white;">Unsubscribe</a>
            </p>
        </div>
    </body>
    </html>
    """
    
    return {
        "success": True,
        "email_content": email_html,
        "summary": summary
    }
# ==================== RE-ANALYZE PROJECT ====================

class ReanalyzeProjectRequest(BaseModel):
    token: str
    project_id: int


@app.post("/reanalyze-project")
async def reanalyze_project(req: ReanalyzeProjectRequest, db: Session = Depends(get_db)):
    """Re-run AI analysis on the project to update progress and context"""
    user = get_current_user(req.token, db)
    project = db.query(Project).filter(Project.id == req.project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user is member
    membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project.id,
        ProjectMember.user_id == user.id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this project")
    
    try:
        # Re-run the AI analysis
        await analyze_repository_initial(project.id, user, db)
        
        # Get updated context
        ai_context = db.query(AIProjectContext).filter(
            AIProjectContext.project_id == project.id
        ).first()
        
        return {
            "success": True,
            "message": "Project re-analyzed successfully",
            "progress": ai_context.current_progress if ai_context else 0,
            "ai_understanding": ai_context.ai_understanding if ai_context else None
        }
    except Exception as e:
        print(f"Error re-analyzing project: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to re-analyze: {str(e)}")
    


# ==================== LINK REPOSITORY TO PROJECT ====================

class LinkRepoRequest(BaseModel):
    token: str
    project_id: int
    repo_name: str
    repo_url: str

@app.post("/link-repo")
async def link_repo(req: LinkRepoRequest, db: Session = Depends(get_db)):
    """Allow freelancer to link a GitHub repo to an existing project"""
    user = get_current_user(req.token, db)
    
    # Check if user is a freelancer
    if user.role != "freelancer":
        raise HTTPException(status_code=403, detail="Only freelancers can link repositories")
    
    # Get project
    project = db.query(Project).filter(Project.id == req.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user is a member of this project
    membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project.id,
        ProjectMember.user_id == user.id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of this project")
    
    # Check if repo is already linked
    if project.is_linked and project.repo_url:
        raise HTTPException(status_code=400, detail="Repository already linked to this project")
    
    # Link the repo
    project.repo_name = req.repo_name
    project.repo_url = req.repo_url
    project.is_linked = True
    db.commit()
    
    # Run initial AI analysis
    try:
        await analyze_repository_initial(project.id, user, db)
    except Exception as e:
        print(f"Error analyzing repository: {str(e)}")
    
    return {
        "success": True,
        "message": "Repository linked successfully",
        "project_id": project.id
    }


class GetRepoStatusRequest(BaseModel):
    token: str
    project_id: int

@app.post("/check-repo-status")
def check_repo_status(req: GetRepoStatusRequest, db: Session = Depends(get_db)):
    """Check if project has a repo linked and if current user can link one"""
    user = get_current_user(req.token, db)
    project = db.query(Project).filter(Project.id == req.project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {
        "has_repo": project.is_linked and project.repo_url is not None,
        "repo_url": project.repo_url,
        "repo_name": project.repo_name,
        "can_link_repo": user.role == "freelancer",
        "user_role": user.role
    }

class DelPro(BaseModel):
    token: str
    id: int
@app.post("/deleteproject")
def deletepro(payload: DelPro, db: Session = Depends(get_db)):
    user = get_current_user(payload.token, db)
    delpro = db.query(Project).filter(Project.id==payload.id).first()
    db.delete(delpro)
    
    db.commit()
    return {"message": "Done!"}