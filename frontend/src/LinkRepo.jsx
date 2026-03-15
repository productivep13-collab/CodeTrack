import { useState, useEffect } from "react";

export default function LinkRepo({ projectId, token, onSuccess, onCancel }) {
    const [repos, setRepos] = useState([]);
    const [selectedRepo, setSelectedRepo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    useEffect(() => {
        fetchRepos();
    }, []);
    
    async function fetchRepos() {
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
    
    async function linkRepository() {
        if (!selectedRepo) {
            alert("Please select a repository");
            return;
        }
        
        setSubmitting(true);
        
        try {
            const response = await fetch('https://codetrack-10l2.onrender.com/link-repo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    project_id: projectId,
                    repo_name: selectedRepo.name,
                    repo_url: selectedRepo.html_url
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('Repository linked successfully!');
                onSuccess();
            } else {
                alert('Failed to link repository');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to link repository');
        } finally {
            setSubmitting(false);
        }
    }
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                <h2 className="text-2xl font-bold mb-4">Link GitHub Repository</h2>
                
                <p className="text-gray-600 mb-6">
                    Select a repository from your GitHub account to track progress for this project.
                </p>
                
                {loading ? (
                    <div className="text-center py-8 text-gray-500">Loading your repositories...</div>
                ) : repos.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-600 mb-4">No repositories found in your GitHub account.</p>
                        <a 
                            href="https://github.com/new" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                        >
                            Create a new repository on GitHub →
                        </a>
                    </div>
                ) : (
                    <div className="space-y-2 mb-6">
                        {repos.map(repo => (
                            <div 
                                key={repo.id}
                                onClick={() => setSelectedRepo(repo)}
                                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                    selectedRepo?.id === repo.id 
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
                                    {selectedRepo?.id === repo.id && (
                                        <div className="text-blue-600 text-2xl">✓</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                <div className="flex gap-3">
                    <button 
                        onClick={onCancel}
                        className="flex-1 px-4 py-3 bg-gray-200 rounded-lg hover:bg-gray-300 font-semibold transition"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={linkRepository}
                        disabled={submitting || !selectedRepo}
                        className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold transition"
                    >
                        {submitting ? 'Linking...' : 'Link Repository'}
                    </button>
                </div>
            </div>
        </div>
    );
}