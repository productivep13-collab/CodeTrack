import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ProjectView from "./ProjectView";
import Clientdashboard from "./Clientdashboard";
import LinkRepo from "./LinkRepo";

export default function Projectviewrouter() {
    const { id } = useParams();
    const token = localStorage.getItem('token');
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [repoStatus, setRepoStatus] = useState(null);
    const [showLinkRepo, setShowLinkRepo] = useState(false);
    
    useEffect(() => {
        fetchUserRole();
        checkRepoStatus();
    }, []);
    
    async function fetchUserRole() {
        try {
            const response = await fetch('http://127.0.0.1:8000/auth/me', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            
            const data = await response.json();
            setUserRole(data.role);
        } catch (error) {
            console.error('Error fetching user role:', error);
            setUserRole('freelancer');
        } finally {
            setLoading(false);
        }
    }
    
    async function checkRepoStatus() {
        try {
            const response = await fetch('http://127.0.0.1:8000/check-repo-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    token, 
                    project_id: parseInt(id) 
                })
            });
            
            const data = await response.json();
            setRepoStatus(data);
            
            // Auto-show link modal if freelancer and no repo
            if (data.can_link_repo && !data.has_repo) {
                setShowLinkRepo(true);
            }
        } catch (error) {
            console.error('Error checking repo status:', error);
        }
    }
    
    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="text-xl text-gray-600">Loading...</div>
            </div>
        );
    }
    
    // Show link repo modal if needed
    if (showLinkRepo && repoStatus?.can_link_repo && !repoStatus?.has_repo) {
        return (
            <LinkRepo 
                projectId={parseInt(id)}
                token={token}
                onSuccess={() => {
                    setShowLinkRepo(false);
                    window.location.reload(); // Reload to fetch project with new repo
                }}
                onCancel={() => setShowLinkRepo(false)}
            />
        );
    }
    
    // Show appropriate view based on role
    if (userRole === 'client') {
        return <Clientdashboard />;
    } else {
        return <ProjectView />;
    }
}