import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function CoderLog2() {
    const [name, setName] = useState("");
    const [role, setRole] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [nameError, setNameError] = useState("");
    const [roleError, setRoleError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        setTimeout(() => {
            const currentToken = localStorage.getItem('token');
            if (!currentToken) {
                setTimeout(() => {
                    alert('No authentication token found. Please login.');
                    navigate('/login');
                }, 2000);
            } else {
                setLoading(false);
            }
        }, 200);
    }, [navigate]);

    async function sendBackend() {
        setNameError("");
        setRoleError("");

        let hasError = false;

        if (!name.trim()) {
            setNameError("Please enter your name");
            hasError = true;
        }

        if (!role) {
            setRoleError("Please select a role");
            hasError = true;
        }

        if (hasError) return;

        const currentToken = localStorage.getItem('token');

        if (!currentToken) {
            alert("No token found. Please login again.");
            navigate('/login');
            return;
        }

        setSubmitting(true);

        try {
            const response = await fetch(`http://127.0.0.1:8000/semiauth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, role, token: currentToken })
            });

            if (!response.ok) {
                const errorData = await response.json();
                let errorMessage = 'Unknown error';
                if (errorData.detail) {
                    errorMessage = typeof errorData.detail === 'string'
                        ? errorData.detail
                        : errorData.detail.map(e => e.msg).join(', ');
                }
                alert(`Error (${response.status}): ${errorMessage}`);
                return;
            }

            navigate('/dashboard');
        } catch (error) {
            alert("Failed to submit. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <div style={styles.loadingWrapper}>
                <style>{css}</style>
                <div style={styles.loadingCard}>
                    <div style={styles.spinner} className="spinner" />
                    <p style={styles.loadingText}>Verifying session…</p>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.wrapper}>
            <style>{css}</style>

            {/* Background noise grain */}
            <div style={styles.grain} />

            <div style={styles.card} className="card-appear">
                {/* Header */}
                <div style={styles.header}>
                    <h1 style={styles.title}>Set up your profile</h1>
                    <p style={styles.subtitle}>Tell us who you are before we take you to your dashboard.</p>
                </div>

                {/* Divider */}
                <div style={styles.divider} />

                {/* Name Field */}
                <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="name-input">
                        Full name
                    </label>
                    <div style={{ position: 'relative' }}>
                        <input
                            id="name-input"
                            type="text"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                if (nameError) setNameError("");
                            }}
                            placeholder="e.g. Alex Rivera"
                            style={{
                                ...styles.input,
                                ...(nameError ? styles.inputError : {}),
                            }}
                            className="input-focus"
                            autoComplete="name"
                        />
                        {name && !nameError && (
                            <span style={styles.checkmark}>✓</span>
                        )}
                    </div>
                    {nameError && <p style={styles.errorText}>{nameError}</p>}
                </div>

                {/* Role Field */}
                <div style={styles.fieldGroup}>
                    <label style={styles.label}>I am joining as a…</label>
                    <div style={styles.roleGrid}>
                        <button
                            onClick={() => {
                                setRole("client");
                                if (roleError) setRoleError("");
                            }}
                            style={{
                                ...styles.roleCard,
                                ...(role === "client" ? styles.roleCardActive : {}),
                            }}
                            className="role-card"
                        >
                            <span style={styles.roleIcon}>🏢</span>
                            <span style={styles.roleLabel}>Client</span>
                            <span style={styles.roleDesc}>I need work done</span>
                            {role === "client" && <span style={styles.roleCheck}>✓</span>}
                        </button>

                        <button
                            onClick={() => {
                                setRole("freelancer");
                                if (roleError) setRoleError("");
                            }}
                            style={{
                                ...styles.roleCard,
                                ...(role === "freelancer" ? styles.roleCardActive : {}),
                            }}
                            className="role-card"
                        >
                            <span style={styles.roleIcon}>💻</span>
                            <span style={styles.roleLabel}>Freelancer</span>
                            <span style={styles.roleDesc}>I offer my skills</span>
                            {role === "freelancer" && <span style={styles.roleCheck}>✓</span>}
                        </button>
                    </div>
                    {roleError && <p style={styles.errorText}>{roleError}</p>}
                </div>

                {/* Submit */}
                <button
                    onClick={sendBackend}
                    disabled={submitting}
                    style={{
                        ...styles.submitBtn,
                        ...(submitting ? styles.submitBtnDisabled : {}),
                    }}
                    className={submitting ? "" : "submit-hover"}
                >
                    {submitting ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={styles.btnSpinner} className="spinner-small" /> Saving…
                        </span>
                    ) : (
                        "Continue to Dashboard →"
                    )}
                </button>

                {/* Status bar */}
                <div style={styles.statusBar}>
                    <span style={{
                        ...styles.statusDot,
                        background: localStorage.getItem('token') ? '#22c55e' : '#ef4444'
                    }} />
                    <span style={styles.statusText}>
                        {localStorage.getItem('token') ? 'Authenticated' : 'No session'}
                    </span>
                </div>
            </div>
        </div>
    );
}

const styles = {
    wrapper: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f3f4f6',
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
    },
    grain: {
        display: 'none',
    },
    card: {
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '20px',
        padding: '40px',
        width: '100%',
        maxWidth: '460px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
        position: 'relative',
        zIndex: 1,
    },
    loadingWrapper: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f3f4f6',
    },
    loadingCard: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
    },
    loadingText: {
        color: '#6b7280',
        fontSize: '14px',
        fontFamily: "'DM Sans', sans-serif",
        margin: 0,
    },
    header: {
        marginBottom: '28px',
    },
    badge: {
        display: 'inline-block',
        fontSize: '11px',
        fontWeight: '600',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#3b82f6',
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '20px',
        padding: '4px 10px',
        marginBottom: '14px',
    },
    title: {
        margin: '0 0 8px',
        fontSize: '26px',
        fontWeight: '700',
        color: '#111827',
        letterSpacing: '-0.5px',
        lineHeight: 1.2,
    },
    subtitle: {
        margin: 0,
        fontSize: '14px',
        color: '#6b7280',
        lineHeight: 1.6,
    },
    divider: {
        height: '1px',
        background: '#e5e7eb',
        marginBottom: '28px',
    },
    fieldGroup: {
        marginBottom: '24px',
    },
    label: {
        display: 'block',
        fontSize: '13px',
        fontWeight: '500',
        color: '#374151',
        marginBottom: '8px',
        letterSpacing: '0.01em',
    },
    input: {
        width: '100%',
        background: '#ffffff',
        border: '1.5px solid #d1d5db',
        borderRadius: '10px',
        padding: '12px 16px',
        fontSize: '15px',
        color: '#111827',
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        fontFamily: "'DM Sans', sans-serif",
    },
    inputError: {
        borderColor: '#ef4444',
        boxShadow: '0 0 0 3px rgba(239,68,68,0.1)',
    },
    checkmark: {
        position: 'absolute',
        right: '14px',
        top: '50%',
        transform: 'translateY(-50%)',
        color: '#22c55e',
        fontSize: '16px',
        fontWeight: '700',
    },
    errorText: {
        margin: '6px 0 0',
        fontSize: '12px',
        color: '#ef4444',
    },
    roleGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
    },
    roleCard: {
        background: '#f9fafb',
        border: '1.5px solid #e5e7eb',
        borderRadius: '12px',
        padding: '16px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '4px',
        position: 'relative',
        transition: 'border-color 0.2s, background 0.2s, transform 0.15s',
        textAlign: 'left',
    },
    roleCardActive: {
        background: '#eff6ff',
        borderColor: '#3b82f6',
        boxShadow: '0 0 0 3px rgba(59,130,246,0.12)',
    },
    roleIcon: {
        fontSize: '20px',
        marginBottom: '4px',
    },
    roleLabel: {
        fontSize: '14px',
        fontWeight: '600',
        color: '#111827',
    },
    roleDesc: {
        fontSize: '12px',
        color: '#9ca3af',
    },
    roleCheck: {
        position: 'absolute',
        top: '10px',
        right: '12px',
        color: '#3b82f6',
        fontSize: '14px',
        fontWeight: '700',
    },
    submitBtn: {
        width: '100%',
        background: '#22c55e',
        color: '#fff',
        border: 'none',
        borderRadius: '10px',
        padding: '14px',
        fontSize: '15px',
        fontWeight: '600',
        cursor: 'pointer',
        letterSpacing: '0.01em',
        transition: 'opacity 0.2s, transform 0.15s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: '4px',
        fontFamily: "'DM Sans', sans-serif",
        boxShadow: '0 4px 14px rgba(34,197,94,0.3)',
    },
    submitBtnDisabled: {
        opacity: 0.6,
        cursor: 'not-allowed',
    },
    btnSpinner: {
        width: '16px',
        height: '16px',
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        display: 'inline-block',
    },
    statusBar: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginTop: '20px',
        justifyContent: 'center',
    },
    statusDot: {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        flexShrink: 0,
    },
    statusText: {
        fontSize: '11px',
        color: '#9ca3af',
        letterSpacing: '0.03em',
    },
    spinner: {
        width: '32px',
        height: '32px',
        border: '3px solid #e5e7eb',
        borderTopColor: '#3b82f6',
        borderRadius: '50%',
    },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

  .card-appear {
    animation: cardIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  @keyframes cardIn {
    from { opacity: 0; transform: translateY(22px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .spinner {
    animation: spin 0.8s linear infinite;
  }
  .spinner-small {
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .input-focus:focus {
    border-color: #3b82f6 !important;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.15) !important;
  }
  .input-focus::placeholder {
    color: #9ca3af;
  }

  .role-card:hover:not([disabled]) {
    border-color: #93c5fd;
    transform: translateY(-2px);
  }

  .submit-hover:hover {
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(34,197,94,0.4) !important;
  }
  .submit-hover:active {
    transform: translateY(0);
  }
`;