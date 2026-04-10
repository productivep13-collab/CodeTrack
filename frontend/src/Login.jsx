import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';

export default function Login() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [processing, setProcessing] = useState(false);
    const hasProcessed = useRef(false);

    useEffect(() => {
        const code = searchParams.get('code');
        
        if (code && !hasProcessed.current) {
            hasProcessed.current = true;
            setProcessing(true);
            
            window.history.replaceState({}, '', '/login');
            
            fetch('https://codetrack-10l2.onrender.com/auth/github', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            })
            .then(res => res.json())
            .then(data => {
                console.log('GitHub auth response:', data);
                if (data.token) {
                    localStorage.setItem('token', data.token);
                    navigate(data.is_new_user ? '/coderlog' : '/dashboard');
                    window.location.reload();
                } else {
                    alert('Login failed - no token received');
                    setProcessing(false);
                }
            })
            .catch(err => {
                console.error('❌ GitHub auth error:', err);
                alert('GitHub login failed');
                setProcessing(false);
                hasProcessed.current = false;
            });
        }
    }, [searchParams, navigate]);
    
    const handleGoogleSuccess = async (credentialResponse) => {
    const decoded = jwtDecode(credentialResponse.credential);
    const response = await fetch('https://codetrack-10l2.onrender.com/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: decoded.email })
    });
    const data = await response.json();
    if (data.token) {
        localStorage.setItem('token', data.token);
        navigate(data.is_new_user ? '/coderlog' : '/dashboard');
        window.location.reload();   // ✅ add this line
    } else {
        alert('Login failed - no token received');
    }
};

    const handleGitHubLogin = async () => {
        const response = await fetch('https://codetrack-10l2.onrender.com/auth/github/login');
        const data = await response.json();
        window.location.href = data.url;
    };

    if (processing) {
        return (
            <div style={styles.loadingScreen}>
                <div style={styles.spinner}></div>
                <p style={styles.loadingText}>Signing you in with GitHub…</p>
                <style>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            {/* Subtle background grid */}
            <div style={styles.bgGrid}></div>

            <div style={styles.card}>
                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.logoRow}>
                        <img src="/image.png" alt="CodeTrack" style={styles.logoMark} />
                        <h1 style={styles.brandName}>CodeTrack</h1>
                    </div>
                    <p style={styles.tagline}>Track your progress. Ship better code.</p>
                </div>

                {/* Divider */}
                <div style={styles.sectionDivider} />

                {/* Login Methods */}
                <div style={styles.methods}>
                    <div style={styles.googleWrapper}>
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => alert('Login Failed')}
                            theme="filled_blue"
                            size="large"
                            width="300"
                        />
                    </div>

                    <div style={styles.orWrapper}>
                        <span style={styles.orLine}></span>
                        <span style={styles.orText}>or</span>
                        <span style={styles.orLine}></span>
                    </div>

                    <button
                        onClick={handleGitHubLogin}
                        style={styles.githubBtn}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = '#1a1a1a';
                            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = '#111111';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
                        }}
                    >
                        <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        Continue with GitHub
                    </button>
                </div>

                {/* Footer */}
                <p style={styles.footer}>
                    New here?{' '}
                    <Link to="/register" style={styles.link}>Create an account</Link>
                </p>
            </div>

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

const styles = {
    page: {
        minHeight: '100vh',
        background: '#f5f6f8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    bgGrid: {
        position: 'absolute',
        inset: 0,
        backgroundImage: `
            linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '32px 32px',
        pointerEvents: 'none',
    },
    card: {
        position: 'relative',
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e4e6ea',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)',
        padding: '40px 36px',
        width: '100%',
        maxWidth: '400px',
    },
    // Removed duplicate header, logoMark, brandName from here
    tagline: {
        margin: 0,
        fontSize: '14px',
        color: '#7a7f8c',
        fontWeight: '400',
    },
    sectionDivider: {
        height: '1px',
        background: '#edeef1',
        marginBottom: '28px',
    },
    methods: {
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
    },
    googleWrapper: {
        display: 'flex',
        justifyContent: 'center',
    },
    orWrapper: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    orLine: {
        flex: 1,
        height: '1px',
        background: '#edeef1',
        display: 'block',
    },
    orText: {
        fontSize: '12px',
        color: '#9da3ae',
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: '0.6px',
        whiteSpace: 'nowrap',
    },
    githubBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        width: '100%',
        background: '#111111',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        padding: '11px 20px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background 0.15s ease, box-shadow 0.15s ease',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        letterSpacing: '0.1px',
    },
    footer: {
        marginTop: '24px',
        textAlign: 'center',
        fontSize: '13.5px',
        color: '#7a7f8c',
    },
    link: {
        color: '#3b6fef',
        fontWeight: '600',
        textDecoration: 'none',
    },
    loadingScreen: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#f5f6f8',
        gap: '16px',
        fontFamily: "'Inter', -apple-system, sans-serif",
    },
    spinner: {
        width: '36px',
        height: '36px',
        border: '3px solid #e4e6ea',
        borderTopColor: '#3b6fef',
        borderRadius: '50%',
        animation: 'spin 0.75s linear infinite',
    },
    loadingText: {
        margin: 0,
        fontSize: '15px',
        color: '#7a7f8c',
        fontWeight: '500',
    },
    // Correct (second) definitions for header, logoRow, logoMark, brandName
    header: {
        textAlign: 'center',
        marginBottom: '28px',
    },
    logoRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        marginBottom: '6px',
    },
    logoMark: {
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        objectFit: 'contain',
    },
    brandName: {
        margin: '0',
        fontSize: '26px',
        fontWeight: '700',
        color: '#0f1117',
        letterSpacing: '-0.5px',
    },
};
