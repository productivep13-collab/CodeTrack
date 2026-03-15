import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// Maps the actual status strings the backend returns to display info
function getStatus(status, progress) {
    // Backend logic: "on_track" if progress > 50, else "in_progress"
    // We derive richer status from progress since backend only sends two values
    if (status === "on_track" || progress > 50) {
        if (progress >= 90) return { label: "Nearly Done", color: "#16a34a", light: "#dcfce7", ring: "#86efac", bar: "#22c55e" };
        return { label: "On Track", color: "#2563eb", light: "#dbeafe", ring: "#93c5fd", bar: "#3b82f6" };
    }
    if (progress >= 20) return { label: "In Progress", color: "#d97706", light: "#fef3c7", ring: "#fcd34d", bar: "#f59e0b" };
    return { label: "Getting Started", color: "#6b7280", light: "#f3f4f6", ring: "#d1d5db", bar: "#9ca3af" };
}

export default function Dashboard() {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all');
    const [deletingId, setDeletingId] = useState(null);
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    useEffect(() => {
        if (!token) { navigate('/login'); return; }
        fetchProjects();
    }, []);

    async function fetchProjects() {
        setError(null);
        try {
            const response = await fetch('http://127.0.0.1:8000/getprojects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            const data = await response.json();
            // data is an array of: { id, name, description, repo_url, created_at, progress, status }
            setProjects(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('Error fetching projects:', e);
            setError('Failed to load projects. Is the backend running?');
        } finally {
            setLoading(false);
        }
    }

    async function deleteProject(e, id) {
        e.stopPropagation();
        if (!confirm('Delete this project? This cannot be undone.')) return;
        setDeletingId(id);
        try {
            const res = await fetch('http://127.0.0.1:8000/deleteproject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, id })
            });
            if (!res.ok) throw new Error('Delete failed');
            setProjects(prev => prev.filter(p => p.id !== id));
        } catch (e) {
            alert('Failed to delete project. Please try again.');
        } finally {
            setDeletingId(null);
        }
    }

    // Filter options derived from actual data
    const filterOptions = [
        { key: 'all',          label: 'All Projects' },
        { key: 'on_track',     label: 'On Track' },
        { key: 'in_progress',  label: 'In Progress' },
    ];

    const filtered = projects.filter(p => {
        if (filter === 'all') return true;
        if (filter === 'on_track') return p.progress > 50;
        if (filter === 'in_progress') return p.progress <= 50;
        return true;
    });

    const avgProgress = projects.length
        ? Math.round(projects.reduce((a, p) => a + (p.progress || 0), 0) / projects.length)
        : 0;

    const onTrackCount   = projects.filter(p => p.progress > 50).length;
    const inProgressCount = projects.filter(p => p.progress <= 50).length;

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}.sk{animation:pulse 1.2s ease-in-out infinite;background:#f1f5f9;border-radius:6px;}`}</style>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
                    <div className="sk" style={{ height: 24, width: '50%' }} />
                    <div className="sk" style={{ height: 14, width: '75%' }} />
                    <div className="sk" style={{ height: 14, width: '60%' }} />
                </div>
            </div>
        );
    }

    return (
        <div style={s.root}>
            <style>{globalCss}</style>

            {/* ── SIDEBAR ── */}
            <aside style={s.sidebar}>
                <div style={s.brand}>
                    <div style={s.brandMark}>C</div>
                    <div>
                        <div style={s.brandName}>CoderLog</div>
                        <div style={s.brandSub}>AI project tracker</div>
                    </div>
                </div>

                {/* Stats */}
                <div style={s.sideSection}>
                    <div style={s.sideSectionLabel}>Overview</div>
                    <div style={s.summaryGrid}>
                        <div style={s.summaryBox}>
                            <div style={{ ...s.summaryNum, color: '#2563eb' }}>{projects.length}</div>
                            <div style={s.summaryLab}>Projects</div>
                        </div>
                        <div style={s.summaryDivider} />
                        <div style={s.summaryBox}>
                            <div style={{ ...s.summaryNum, color: '#16a34a' }}>{avgProgress}%</div>
                            <div style={s.summaryLab}>Avg. progress</div>
                        </div>
                    </div>
                </div>

                {/* Filter nav */}
                <div style={s.sideSection}>
                    <div style={s.sideSectionLabel}>Filter</div>
                    <nav style={s.nav}>
                        {filterOptions.map(({ key, label }) => {
                            const count = key === 'all' ? projects.length
                                        : key === 'on_track' ? onTrackCount
                                        : inProgressCount;
                            const dotColor = key === 'on_track' ? '#22c55e'
                                           : key === 'in_progress' ? '#f59e0b'
                                           : null;
                            return (
                                <button key={key} onClick={() => setFilter(key)}
                                    style={{ ...s.navItem, ...(filter === key ? s.navActive : {}) }}
                                    className="nav-item">
                                    {dotColor
                                        ? <span style={{ ...s.navDot, background: dotColor }} />
                                        : <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                                    }
                                    <span style={s.navLabel}>{label}</span>
                                    <span style={{ ...s.navCount, ...(filter === key ? { background: '#111827', color: '#fff' } : {}) }}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                <div style={{ flex: 1 }} />

                <button onClick={() => navigate('/createproject')} style={s.newBtn} className="new-btn">
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                    New Project
                </button>

                <button onClick={() => { localStorage.removeItem('token'); navigate('/login'); window.location.reload();}} style={s.logoutBtn} className="logout-btn">
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"/>
                    </svg>
                    Logout
                </button>
            </aside>

            {/* ── MAIN ── */}
            <main style={s.main}>
                <div style={s.topBar}>
                    <div>
                        <h1 style={s.pageTitle}>
                            {filter === 'all' ? 'All Projects'
                           : filter === 'on_track' ? 'On Track'
                           : 'In Progress'}
                        </h1>
                        <p style={s.pageSub}>{filtered.length} project{filtered.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button onClick={fetchProjects} style={s.refreshBtn} className="refresh-btn">
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                        </svg>
                        Refresh
                    </button>
                </div>

                {error && (
                    <div style={s.errorBanner}>
                        <svg width="15" height="15" fill="none" stroke="#dc2626" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="9"/><path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
                        </svg>
                        {error}
                        <button onClick={fetchProjects} style={s.retryBtn}>Retry</button>
                    </div>
                )}

                {!error && filtered.length === 0 ? (
                    <div style={s.emptyWrap}>
                        <div style={s.emptyBox}>
                            <div style={s.emptyIcon}>
                                <svg width="28" height="28" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h12"/>
                                </svg>
                            </div>
                            <p style={s.emptyTitle}>
                                {filter !== 'all' ? `No "${filter === 'on_track' ? 'On Track' : 'In Progress'}" projects` : 'No projects yet'}
                            </p>
                            <p style={s.emptySub}>
                                {filter !== 'all' ? 'Try switching to "All Projects" above.' : 'Create your first project to get started.'}
                            </p>
                            {filter === 'all' && (
                                <button onClick={() => navigate('/createproject')} style={s.emptyBtn} className="new-btn">
                                    Create project
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={s.grid}>
                        {filtered.map((project, i) => {
                            const st = getStatus(project.status, project.progress ?? 0);
                            const isDeleting = deletingId === project.id;
                            return (
                                <div key={project.id}
                                    onClick={() => !isDeleting && navigate(`/project/${project.id}`)}
                                    className="project-card"
                                    style={{ ...s.card, opacity: isDeleting ? 0.5 : 1, animationDelay: `${i * 0.04}s`, pointerEvents: isDeleting ? 'none' : 'auto' }}>

                                    <div style={{ ...s.cardAccent, background: st.bar }} />

                                    <div style={s.cardBody}>
                                        <div style={s.cardHeader}>
                                            <span style={{ ...s.chip, background: st.light, color: st.color, border: `1px solid ${st.ring}` }}>
                                                <span style={{ ...s.chipDot, background: st.bar }} />
                                                {st.label}
                                            </span>
                                            <span style={s.pct}>{project.progress ?? 0}%</span>
                                        </div>

                                        <h3 style={s.cardName}>{project.name}</h3>

                                        {project.description && (
                                            <p style={s.cardDesc}>{project.description}</p>
                                        )}

                                        <div style={s.track}>
                                            <div style={{ ...s.fill, width: `${project.progress ?? 0}%`, background: st.bar }} />
                                        </div>

                                        <div style={s.cardFooter}>
                                            <div style={s.footerLeft}>
                                                {project.repo_url ? (
                                                    <span style={s.repoBadge}>
                                                        <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24">
                                                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22v3.293c0 .319.192.694.801.576C20.565 21.796 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
                                                        </svg>
                                                        Linked
                                                    </span>
                                                ) : (
                                                    <span style={s.noRepoBadge}>No repo</span>
                                                )}
                                                <span style={s.date}>
                                                    {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                            </div>
                                            <div style={s.actions}>
                                                <button onClick={(e) => deleteProject(e, project.id)}
                                                    style={s.deleteBtn} className="delete-btn"
                                                    title="Delete project">
                                                    {isDeleting
                                                        ? <svg width="11" height="11" fill="none" stroke="#ef4444" strokeWidth="2.5" viewBox="0 0 24 24" style={{ animation: 'spin 0.8s linear infinite' }}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9"/></svg>
                                                        : <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                                    }
                                                </button>
                                                <span style={s.viewLink}>
                                                    View
                                                    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                                                    </svg>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}

const s = {
    root: { display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Sora', 'DM Sans', sans-serif" },
    sidebar: { width: 240, flexShrink: 0, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', padding: '20px 14px', gap: 20, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' },
    brand: { display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 16px', borderBottom: '1px solid #f1f5f9' },
    brandMark: { width: 34, height: 34, borderRadius: 10, background: '#111827', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flexShrink: 0 },
    brandName: { fontSize: 14, fontWeight: 800, color: '#111827', letterSpacing: '-0.3px' },
    brandSub: { fontSize: 10, color: '#9ca3af', fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase' },
    sideSection: { display: 'flex', flexDirection: 'column', gap: 8 },
    sideSectionLabel: { fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.07em', textTransform: 'uppercase', padding: '0 6px' },
    summaryGrid: { display: 'flex', background: '#f8fafc', borderRadius: 10, padding: '10px 0' },
    summaryBox: { flex: 1, textAlign: 'center' },
    summaryNum: { fontSize: 22, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
    summaryLab: { fontSize: 10, color: '#9ca3af', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 3 },
    summaryDivider: { width: 1, background: '#e5e7eb', margin: '4px 0' },
    nav: { display: 'flex', flexDirection: 'column', gap: 1 },
    navItem: { display: 'flex', alignItems: 'center', gap: 9, padding: '8px 8px', borderRadius: 7, border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#6b7280', textAlign: 'left', transition: 'background 0.1s, color 0.1s', width: '100%' },
    navActive: { background: '#f8fafc', color: '#111827', fontWeight: 700 },
    navDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
    navLabel: { flex: 1 },
    navCount: { fontSize: 11, fontWeight: 700, background: '#f1f5f9', color: '#6b7280', padding: '2px 7px', borderRadius: 99, fontVariantNumeric: 'tabular-nums' },
    newBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#111827', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' },
    logoutBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'none', color: '#9ca3af', border: '1px solid #e5e7eb', borderRadius: 10, padding: '9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'color 0.15s, border-color 0.15s' },
    main: { flex: 1, padding: '36px 40px', overflow: 'auto' },
    topBar: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 },
    pageTitle: { margin: '0 0 3px', fontSize: 26, fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' },
    pageSub: { margin: 0, fontSize: 13, color: '#9ca3af', fontWeight: 500 },
    refreshBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: '#6b7280', cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s' },
    errorBanner: { display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#dc2626', fontWeight: 500 },
    retryBtn: { marginLeft: 'auto', background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' },
    emptyWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
    emptyBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' },
    emptyIcon: { width: 56, height: 56, borderRadius: 14, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    emptyTitle: { margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' },
    emptySub: { margin: 0, fontSize: 13, color: '#9ca3af' },
    emptyBtn: { marginTop: 6, display: 'flex', alignItems: 'center', gap: 7, background: '#111827', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
    card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column', transition: 'box-shadow 0.18s, transform 0.15s', animation: 'cardIn 0.3s cubic-bezier(0.22,1,0.36,1) both' },
    cardAccent: { height: 3, flexShrink: 0 },
    cardBody: { padding: '16px 18px 14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 },
    cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    chip: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, letterSpacing: '0.04em', textTransform: 'uppercase' },
    chipDot: { width: 5, height: 5, borderRadius: '50%', flexShrink: 0 },
    pct: { fontSize: 18, fontWeight: 800, color: '#111827', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' },
    cardName: { margin: 0, fontSize: 15, fontWeight: 700, color: '#111827', lineHeight: 1.35, letterSpacing: '-0.2px' },
    cardDesc: { margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
    track: { height: 4, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 99, transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)' },
    cardFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #f8fafc', marginTop: 2 },
    footerLeft: { display: 'flex', alignItems: 'center', gap: 8 },
    date: { fontSize: 11, color: '#9ca3af', fontWeight: 500, fontVariantNumeric: 'tabular-nums' },
    repoBadge: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#dcfce7', border: '1px solid #86efac', padding: '2px 6px', borderRadius: 99 },
    noRepoBadge: { fontSize: 10, fontWeight: 600, color: '#9ca3af', background: '#f1f5f9', padding: '2px 6px', borderRadius: 99 },
    actions: { display: 'flex', alignItems: 'center', gap: 8 },
    deleteBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: '1px solid #fee2e2', background: '#fff5f5', color: '#ef4444', cursor: 'pointer', transition: 'background 0.12s' },
    viewLink: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#2563eb' },
};

const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  @keyframes cardIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  .project-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.09) !important; transform: translateY(-2px) !important; }
  .nav-item:hover { background: #f8fafc !important; color: #374151 !important; }
  .new-btn:hover { background: #1f2937 !important; }
  .logout-btn:hover { color: #374151 !important; border-color: #d1d5db !important; }
  .delete-btn:hover { background: #fee2e2 !important; }
  .refresh-btn:hover { color: #374151 !important; border-color: #9ca3af !important; }
  @media (max-width: 640px) { aside { display:none; } main { padding: 20px 16px !important; } }
`;