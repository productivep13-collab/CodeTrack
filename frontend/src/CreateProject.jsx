import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function CreateProject() {
    const token = localStorage.getItem('token');
    const navigate = useNavigate();
    
    // Form states
    const [step, setStep] = useState(1);
    const [repos, setRepos] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Project data
    const [projectData, setProjectData] = useState({
        name: "",
        description: "",
        selectedRepo: null,
        projectType: "",
        requiredFeatures: "",
        deadline: "",
        specialRequirements: "",
        budget: "",
        technicalStack: ""
    });
    
    useEffect(() => {
        fetchRepos();
    }, []);
    
    async function fetchRepos() {
        setLoading(true);
        try {
            const response = await fetch('https://codetrack-10l2.onrender.com/getallrepos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const data = await response.json();
            setRepos(data);
        } catch (error) {
            console.error('Error fetching repos:', error);
        } finally {
            setLoading(false);
        }
    }
    

async function createProject() {
    if (!projectData.name || !projectData.description) {
        alert("Please fill in project name and description");
        return;
    }
    
    setLoading(true);
    
    try {
        const response = await fetch('https://codetrack-10l2.onrender.com/createproject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token,
                name: projectData.name,
                description: projectData.description,
                repo_url: projectData.selectedRepo?.html_url || null,
                repo_name: projectData.selectedRepo?.name || null,
                project_type: projectData.projectType,
                required_features: projectData.requiredFeatures,
                deadline: projectData.deadline,
                special_requirements: projectData.specialRequirements,
                budget: projectData.budget ? parseInt(projectData.budget) : null,
                technical_stack: projectData.technicalStack
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            navigate('/dashboard');
        } else {
            alert('Error creating project');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to create project');
    } finally {
        setLoading(false);
    }
}
    function renderStep1() {
        return (
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Project Name *
                    </label>
                    <input 
                        type="text"
                        value={projectData.name}
                        onChange={e => setProjectData({...projectData, name: e.target.value})}
                        placeholder="e.g., E-commerce Website"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        What are you building? *
                    </label>
                    <input 
                        type="text"
                        value={projectData.projectType}
                        onChange={e => setProjectData({...projectData, projectType: e.target.value})}
                        placeholder="e.g., Full-stack web application"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Describe your project in detail *
                    </label>
                    <textarea 
                        value={projectData.description}
                        onChange={e => setProjectData({...projectData, description: e.target.value})}
                        placeholder="Explain what this project should do, who it's for, and any important details. The AI will use this to understand your project."
                        rows="5"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        💡 Be detailed - this helps the AI track progress accurately
                    </p>
                </div>
                
                <button 
                    onClick={() => setStep(2)}
                    disabled={!projectData.name || !projectData.description}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                >
                    Next: Select Repository →
                </button>
            </div>
        );
    }
    
function renderStep2() {
    return (
        <div className="space-y-6">
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Select GitHub Repository (Optional - can be added later by freelancer)
                </label>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-blue-800">
                        💡 <strong>Tip:</strong> If you're a client, you can skip this step. 
                        Your freelancer can add the repository later.
                    </p>
                </div>
                
                {loading ? (
                    <div className="text-center py-8 text-gray-500">Loading repositories...</div>
                ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-2">
                        {repos.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <p>No repositories found.</p>
                                <p className="text-sm mt-2">Connect GitHub or skip this step.</p>
                            </div>
                        ) : (
                            repos.map(repo => (
                                <div 
                                    key={repo.id}
                                    onClick={() => setProjectData({...projectData, selectedRepo: repo})}
                                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                        projectData.selectedRepo?.id === repo.id 
                                            ? 'border-blue-500 bg-blue-50' 
                                            : 'border-gray-200 hover:border-blue-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-semibold text-gray-900">{repo.name}</div>
                                            {repo.description && (
                                                <div className="text-sm text-gray-600 mt-1">{repo.description}</div>
                                            )}
                                        </div>
                                        {projectData.selectedRepo?.id === repo.id && (
                                            <div className="text-blue-600 text-xl">✓</div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
            
            <div className="flex gap-4">
                <button 
                    onClick={() => setStep(1)}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                    ← Back
                </button>
                <button 
                    onClick={() => setStep(3)}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                    {projectData.selectedRepo ? 'Next: AI Setup →' : 'Skip & Continue →'}
                </button>
            </div>
        </div>
    );
}
    function renderStep3() {
        return (
            <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-blue-900 mb-2">🤖 Help AI Understand Your Project</h3>
                    <p className="text-sm text-blue-700">
                        The AI will track progress and answer questions. Provide details to get better insights.
                    </p>
                </div>
                
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        What features do you need?
                    </label>
                    <textarea 
                        value={projectData.requiredFeatures}
                        onChange={e => setProjectData({...projectData, requiredFeatures: e.target.value})}
                        placeholder="e.g., User login, shopping cart, payment processing, admin dashboard"
                        rows="3"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Technical Stack (if known)
                    </label>
                    <input 
                        type="text"
                        value={projectData.technicalStack}
                        onChange={e => setProjectData({...projectData, technicalStack: e.target.value})}
                        placeholder="e.g., React, Node.js, MongoDB, Stripe"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Deadline (optional)
                        </label>
                        <input 
                            type="date"
                            value={projectData.deadline}
                            onChange={e => setProjectData({...projectData, deadline: e.target.value})}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Budget (optional)
                        </label>
                        <input 
                            type="number"
                            value={projectData.budget}
                            onChange={e => setProjectData({...projectData, budget: e.target.value})}
                            placeholder="5000"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>
                
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Special Requirements (optional)
                    </label>
                    <textarea 
                        value={projectData.specialRequirements}
                        onChange={e => setProjectData({...projectData, specialRequirements: e.target.value})}
                        placeholder="e.g., Must work on mobile, needs to be secure, should load fast"
                        rows="2"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                </div>
                
                <div className="flex gap-4">
                    <button 
                        onClick={() => setStep(2)}
                        className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                    >
                        ← Back
                    </button>
                    <button 
                        onClick={createProject}
                        disabled={loading}
                        className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                    >
                        {loading ? 'Creating...' : '✓ Create Project'}
                    </button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button 
                        onClick={() => navigate('/dashboard')}
                        className="text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-2"
                    >
                        ← Back to Dashboard
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900">Create New Project</h1>
                    <p className="text-gray-600 mt-2">Step {step} of 3</p>
                </div>
                
                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex gap-2">
                        <div className={`flex-1 h-2 rounded ${step >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
                        <div className={`flex-1 h-2 rounded ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
                        <div className={`flex-1 h-2 rounded ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
                    </div>
                </div>
                
                {/* Form Card */}
                <div className="bg-white rounded-xl shadow-lg p-8">
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                </div>
            </div>
        </div>
    );
}