from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text, UniqueConstraint, Float
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
from database import Base

class User(Base):
    """User model - can be either client or freelancer"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False, default="bruhGetSomeName")
    
    github_name = Column(String)
    picture = Column(String)
    role = Column(String, nullable=False, default="pending")

    github_token = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    owned_projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    project_memberships = relationship(
        "ProjectMember", 
        back_populates="user", 
        cascade="all, delete-orphan",
        foreign_keys="ProjectMember.user_id"
    )
    
    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"


class Project(Base):
    """Project model - created by clients or freelancers"""
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # GitHub integration
    is_linked = Column(Boolean, default=False)
    repo_url = Column(String)
    repo_name = Column(String)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    owner = relationship("User", back_populates="owned_projects")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    ai_context = relationship("AIProjectContext", back_populates="project", uselist=False, cascade="all, delete-orphan")
    commit_explanations = relationship("CommitExplanation", back_populates="project", cascade="all, delete-orphan")
    chat_history = relationship("AIChatHistory", back_populates="project", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Project(id={self.id}, name={self.name}, owner_id={self.owner_id})>"


class ProjectMember(Base):
    """Junction table - links users to projects with specific roles"""
    __tablename__ = "project_members"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    member_role = Column(String, nullable=False)
    can_link_repo = Column(Boolean, default=False)
    can_invite_members = Column(Boolean, default=False)
    
    joined_at = Column(DateTime, default=datetime.utcnow)
    invited_by_id = Column(Integer, ForeignKey("users.id"))
    
    # Relationships
    project = relationship("Project", back_populates="members")
    user = relationship(
        "User", 
        back_populates="project_memberships",
        foreign_keys=[user_id]
    )
    invited_by = relationship(
        "User", 
        foreign_keys=[invited_by_id]
    )
    
    __table_args__ = (
        UniqueConstraint('project_id', 'user_id', name='unique_project_member'),
    )
    
    def __repr__(self):
        return f"<ProjectMember(project_id={self.project_id}, user_id={self.user_id}, role={self.member_role})>"


class AIProjectContext(Base):
    """Stores AI's understanding of the project"""
    __tablename__ = "ai_project_contexts"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), unique=True)
    
    # From client/developer input:
    project_type = Column(String)
    required_features = Column(Text)
    deadline = Column(DateTime, nullable=True)
    special_requirements = Column(Text)
    budget = Column(Integer, nullable=True)
    technical_stack = Column(String)
    
    # AI-generated insights:
    ai_understanding = Column(Text)
    estimated_timeline = Column(String)
    complexity_score = Column(Float)
    current_progress = Column(Integer, default=0)
    completed_features = Column(Text)
    pending_features = Column(Text)
    
    # Tracking:
    last_ai_sync = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    project = relationship("Project", back_populates="ai_context")
    
    def __repr__(self):
        return f"<AIProjectContext(project_id={self.project_id}, progress={self.current_progress}%)>"


class CommitExplanation(Base):
    """Stores AI explanations for each commit"""
    __tablename__ = "commit_explanations"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    commit_sha = Column(String, unique=True, index=True)
    commit_message = Column(String)
    commit_author = Column(String)
    commit_date = Column(DateTime)
    
    # Commit stats
    files_changed = Column(Integer)
    additions = Column(Integer)
    deletions = Column(Integer)
    
    # AI-generated explanations:
    ai_explanation = Column(Text)
    ai_impact = Column(Text)
    progress_delta = Column(Integer, default=0)
    is_flagged = Column(Boolean, default=False)
    flag_reason = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    project = relationship("Project", back_populates="commit_explanations")
    
    def __repr__(self):
        return f"<CommitExplanation(commit_sha={self.commit_sha[:8]}, project_id={self.project_id})>"


class AIChatHistory(Base):
    """Stores chat conversations with AI"""
    __tablename__ = "ai_chat_history"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    user_question = Column(Text)
    ai_response = Column(Text)
    
    # For context:
    referenced_commits = Column(JSONB, default=list)
    referenced_files = Column(JSONB, default=list)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    project = relationship("Project", back_populates="chat_history")
    user = relationship("User")
    
    def __repr__(self):
        return f"<AIChatHistory(id={self.id}, project_id={self.project_id})>"