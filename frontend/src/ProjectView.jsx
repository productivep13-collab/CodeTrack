import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function ProjectView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    
    const [project, setProject] = useState(null);
    const [aiContext, setAiContext] = useState(null);
    const [commits, setCommits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Chat state
    const [activeTab, setActiveTab] = useState('progress');
    const [question, setQuestion] = useState("");
    const [chatHistory, setChatHistory] = useState([]);
    const [chatLoading, setChatLoading] = useState(false);
    
    // Member invitation state
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [memberName, setMemberName] = useState("");
    const [memberRole, setMemberRole] = useState("");
    
    useEffect(() => {
        fetchProject();
        fetchChatHistory();
    }, [id]);
    
    async function fetchProject() {
        try {
            const response = await fetch('https://codetrack-10l2.onrender.com/getproject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    project_id: parseInt(id)
                })
            });
            
            const data = await response.json();
            setProject(data.project);
            setAiContext(data.ai_context);
            setCommits(data.commits);
        } catch (error) {
            console.error('Error fetching project:', error);
        } finally {
            setLoading(false);
        }
    }
    
    async function fetchChatHistory() {
        try {
            const response = await fetch('https://codetrack-10l2.onrender.com/get-chat-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    project_id: parseInt(id)
                })
            });
            
            const data = await response.json();
            setChatHistory(data);
        } catch (error) {
            console.error('Error fetching chat history:', error);
        }
    }
    
    async function askAI() {
        if (!question.trim()) return;
        
        const q = question.trim();
        setQuestion("");
        setChatLoading(true);

        // Optimistic update - show user message immediately with null answer
        setChatHistory(prev => [...prev, { question: q, answer: null, created_at: new Date().toISOString() }]);
        
        try {
            const response = await fetch('https://codetrack-10l2.onrender.com/ask-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    project_id: parseInt(id),
                    question: q
                })
            });
            
            const data = await response.json();
            
            setChatHistory(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { question: q, answer: data.answer, created_at: new Date().toISOString() };
                return updated;
            });
        } catch (error) {
            console.error('Error asking AI:', error);
            setChatHistory(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { question: q, answer: "Sorry, failed to get a response. Please try again.", created_at: new Date().toISOString() };
                return updated;
            });
        } finally {
            setChatLoading(false);
        }
    }
    
    async function inviteMember() {
        if (!memberName.trim() || !memberRole) {
            alert("Please enter member name and select a role");
            return;
        }
        
        try {
            const response = await fetch('https://codetrack-10l2.onrender.com/addmember', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    name: memberName,
                    id: parseInt(id),
                    role: memberRole
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('Member added successfully!');
                setShowInviteModal(false);
                setMemberName("");
                setMemberRole("");
            } else {
                alert('Failed to add member');
            }
        } catch (error) {
            console.error('Error inviting member:', error);
            alert('Failed to invite member');
        }
    }
    
    async function refreshCommits() {
        setRefreshing(true);
        try {
            const response = await fetch('https://codetrack-10l2.onrender.com/refresh-commits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    project_id: parseInt(id)
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                await fetchProject();
                alert(`Commits refreshed! Progress updated to ${data.progress}%`);
            } else {
                alert('Failed to refresh commits');
            }
        } catch (error) {
            console.error('Error refreshing commits:', error);
            alert('Failed to refresh commits');
        } finally {
            setRefreshing(false);
        }
    }
    
    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="text-xl text-gray-600">Loading project...</div>
            </div>
        );
    }
    
    if (!project) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="text-xl text-red-600">Project not found</div>
            </div>
        );
    }
    function formatAIMessage(text) {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
        // Bold: **text**
        const parts = line.split(/\*\*(.*?)\*\*/g).map((part, j) =>
            j % 2 === 1 ? <strong key={j}>{part}</strong> : part
        );
        // Empty line = spacer
        if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
        // Bullet lines
        if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
            return (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
                    <span style={{ color: '#9ca3af', flexShrink: 0 }}>•</span>
                    <span>{parts}</span>
                </div>
            );
        }
        return <div key={i} style={{ marginBottom: 2 }}>{parts}</div>;
    });
}
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <button 
                        onClick={() => navigate('/dashboard')}
                        className="text-gray-600 hover:text-gray-900 mb-3 flex items-center gap-2"
                    >
                        ← Back to Dashboard
                    </button>
                    
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
                            <p className="text-gray-600 mt-2">{project.description}</p>
                            <a 
                                href={project.repo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                            >
                                View on GitHub →
                            </a>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setShowInviteModal(true)}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                            >
                                + Invite Member
                            </button>
                            
                            {aiContext && (
                                <div className="text-right">
                                    <div className="text-4xl font-bold text-blue-600">{aiContext.progress}%</div>
                                    <div className="text-sm text-gray-600">Complete</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Invite Member Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h2 className="text-xl font-bold mb-4">Invite Team Member</h2>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Member Name
                            </label>
                            <input 
                                type="text"
                                value={memberName}
                                onChange={(e) => setMemberName(e.target.value)}
                                placeholder="Enter name"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>
                        
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Role
                            </label>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setMemberRole("client")}
                                    className={`px-4 py-2 rounded-lg flex-1 ${
                                        memberRole === "client" 
                                            ? "bg-blue-500 text-white" 
                                            : "bg-gray-200"
                                    }`}
                                >
                                    Client
                                </button>
                                <button 
                                    onClick={() => setMemberRole("freelancer")}
                                    className={`px-4 py-2 rounded-lg flex-1 ${
                                        memberRole === "freelancer" 
                                            ? "bg-blue-500 text-white" 
                                            : "bg-gray-200"
                                    }`}
                                >
                                    Freelancer
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => {
                                    setShowInviteModal(false);
                                    setMemberName("");
                                    setMemberRole("");
                                }}
                                className="flex-1 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={inviteMember}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                                Invite
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Tabs */}
            <div className="max-w-7xl mx-auto px-6">
                <div className="border-b border-gray-200">
                    <div className="flex gap-8">
                        <button 
                            onClick={() => setActiveTab('progress')}
                            className={`py-4 px-2 border-b-2 font-semibold transition ${
                                activeTab === 'progress' 
                                    ? 'border-blue-600 text-blue-600' 
                                    : 'border-transparent text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            Progress Timeline
                        </button>
                        <button 
                            onClick={() => setActiveTab('chat')}
                            className={`py-4 px-2 border-b-2 font-semibold transition ${
                                activeTab === 'chat' 
                                    ? 'border-blue-600 text-blue-600' 
                                    : 'border-transparent text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            Ask AI
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Tab Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {activeTab === 'progress' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-gray-900">Recent Activity</h2>
                            <div className="flex gap-2">
                                <button 
                                    onClick={refreshCommits}
                                    disabled={refreshing}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
                                >
                                    {refreshing ? 'Refreshing...' : '🔄 Refresh Commits'}
                                </button>
                                <button 
                                    onClick={async () => {
                                        setRefreshing(true);
                                        try {
                                            const response = await fetch('https://codetrack-10l2.onrender.com/reanalyze-project', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ token, project_id: parseInt(id) })
                                            });
                                            const data = await response.json();
                                            if (data.success) {
                                                await fetchProject();
                                                alert(`Re-analyzed! Progress: ${data.progress}%`);
                                            }
                                        } catch (error) {
                                            alert('Failed to re-analyze');
                                        } finally {
                                            setRefreshing(false);
                                        }
                                    }}
                                    disabled={refreshing}
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition"
                                >
                                    {refreshing ? 'Analyzing...' : '🤖 Re-analyze Progress'}
                                </button>
                            </div>
                        </div>
                        
                        {commits.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                No commits yet. Start coding to see progress here!
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {commits.map((commit, index) => (
                                    <div key={commit.sha} className="bg-white border rounded-xl p-6 shadow-sm hover:shadow-md transition">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex-1">
                                                <div className="font-semibold text-gray-900 mb-1">
                                                    {commit.message}
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    {commit.author} • {new Date(commit.date).toLocaleDateString()} at {new Date(commit.date).toLocaleTimeString()}
                                                </div>
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {commit.files_changed} files • +{commit.additions} -{commit.deletions}
                                            </div>
                                        </div>
                                        
                                        {commit.ai_explanation && (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="text-2xl">🤖</div>
                                                    <div className="flex-1">
                                                        <div className="font-medium text-blue-900 mb-1">AI Explanation:</div>
                                                        <div className="text-blue-800 text-sm">{commit.ai_explanation}</div>
                                                        {commit.ai_impact && (
                                                            <div className="mt-2 text-sm text-blue-700">
                                                                <strong>Impact:</strong> {commit.ai_impact}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {commit.is_flagged && (
                                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
                                                <div className="flex items-center gap-2 text-red-800">
                                                    <span className="text-xl">⚠️</span>
                                                    <span className="font-medium">Flagged:</span>
                                                    <span className="text-sm">{commit.flag_reason}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                
                {activeTab === 'chat' && (
                    <div className="max-w-4xl mx-auto">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Ask AI About This Project</h2>
                        
                        {/* Chat History */}
                        <div className="bg-white border rounded-xl p-6 mb-6 overflow-y-auto" style={{ minHeight: '400px', maxHeight: '500px' }}>
                            {chatHistory.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <div className="text-4xl mb-3">💬</div>
                                    <p>No questions yet. Ask the AI anything about this project!</p>
                                    <div className="mt-6 text-left">
                                        <div className="text-sm font-semibold text-gray-700 mb-2">Try asking:</div>
                                        <div className="space-y-2">
                                            {[
                                                "What has been built so far?",
                                                "Is the project on track?",
                                                "What features are still pending?",
                                                "Explain the latest changes"
                                            ].map(q => (
                                                <button 
                                                    key={q}
                                                    onClick={() => setQuestion(q)}
                                                    className="block w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm text-gray-700 transition"
                                                >
                                                    "{q}"
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {chatHistory.map((chat, index) => (
                                        <div key={index}>
                                            {/* User bubble */}
                                            <div className="flex justify-end mb-2">
                                                <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-lg text-sm">
                                                    {chat.question}
                                                </div>
                                            </div>
                                            {/* AI bubble */}
                                            <div className="flex justify-start gap-2">
                                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs flex-shrink-0 mt-1">
                                                    AI
                                                </div>
                                                {chat.answer === null ? (
                                                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-500">
                                                        Thinking…
                                                    </div>
                                                ) : (
                                                    <div className="bg-gray-100 text-gray-900 rounded-2xl rounded-tl-sm px-4 py-2 max-w-lg text-sm leading-relaxed">
    {formatAIMessage(chat.answer)}
</div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        {/* Input */}
                        <div className="flex gap-3">
                            <input 
                                type="text"
                                value={question}
                                onChange={e => setQuestion(e.target.value)}
                                onKeyPress={e => e.key === 'Enter' && !chatLoading && askAI()}
                                placeholder="Ask anything about this project..."
                                disabled={chatLoading}
                                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                            />
                            <button 
                                onClick={askAI}
                                disabled={chatLoading || !question.trim()}
                                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                            >
                                {chatLoading ? 'Asking…' : 'Ask'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
