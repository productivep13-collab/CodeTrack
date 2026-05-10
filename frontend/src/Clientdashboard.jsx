import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function Clientdashboard() {
    const { id } = useParams();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    const [project, setProject] = useState(null);
    const [aiContext, setAiContext] = useState(null);
    const [commits, setCommits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [weeklyActivity, setWeeklyActivity] = useState([]);
    const [activeTab, setActiveTab] = useState('overview');
    const [progressAnim, setProgressAnim] = useState(0);
    const animRef = useRef(null);

    // Chat state
    const [question, setQuestion] = useState("");
    const [chatHistory, setChatHistory] = useState([]);
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef(null);

    // Invite member state
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [memberName, setMemberName] = useState("");
    const [memberRole, setMemberRole] = useState("");

    useEffect(() => { fetchProject(); fetchChatHistory(); }, [id]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    useEffect(() => {
        if (!loading && aiContext) {
            const target = aiContext.progress || 0;
            let current = 0;
            const step = target / 60;
            animRef.current = setInterval(() => {
                current += step;
                if (current >= target) { current = target; clearInterval(animRef.current); }
                setProgressAnim(Math.round(current));
            }, 16);
            return () => clearInterval(animRef.current);
        }
    }, [loading, aiContext]);

    async function fetchProject() {
        try {
            const response = await fetch('https://codetrack-10l2.onrender.com/getproject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, project_id: parseInt(id) })
            });
            const data = await response.json();
            setProject(data.project);
            setAiContext(data.ai_context);
            setCommits(data.commits);
            setWeeklyActivity(data.commits.slice(0, 7));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }

    async function fetchChatHistory() {
        try {
            const response = await fetch('https://codetrack-10l2.onrender.com/get-chat-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, project_id: parseInt(id) })
            });
            const data = await response.json();
            setChatHistory(data);
        } catch (e) { console.error(e); }
    }

    async function askAI() {
        if (!question.trim()) return;
        const q = question.trim();
        setQuestion("");
        setChatLoading(true);
        setChatHistory(prev => [...prev, { question: q, answer: null, created_at: new Date().toISOString() }]);
        try {
            const response = await fetch('https://codetrack-10l2.onrender.com/ask-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, project_id: parseInt(id), question: q })
            });
            const data = await response.json();
            setChatHistory(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { question: q, answer: data.answer, created_at: new Date().toISOString() };
                return updated;
            });
        } catch (e) {
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
        if (!memberName.trim() || !memberRole) { alert("Please enter name and select a role"); return; }
        try {
            const res = await fetch("https://codetrack-10l2.onrender.com/addmember", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, name: memberName, id: parseInt(id), role: memberRole })
            });
            const data = await res.json();
            if (data.success) { alert("Member added!"); setShowInviteModal(false); setMemberName(""); setMemberRole(""); }
            else alert("Failed to add member");
        } catch(e) { alert("Failed to add member"); }
    }

    async function refreshData() {
        setRefreshing(true);
        try {
            const res = await fetch('https://codetrack-10l2.onrender.com/refresh-commits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, project_id: parseInt(id) })
            });
            const d = await res.json();
            if (d.success) await fetchProject();
        } catch (e) { console.error(e); }
        finally { setRefreshing(false); }
    }

    function getStatus() {
        const p = aiContext?.progress || 0;
        if (p >= 90) return { label: "Nearly Complete", color: "#16a34a", light: "#dcfce7", ring: "#86efac" };
        if (p >= 70) return { label: "On Track", color: "#2563eb", light: "#dbeafe", ring: "#93c5fd" };
        if (p >= 40) return { label: "Progressing", color: "#7c3aed", light: "#ede9fe", ring: "#c4b5fd" };
        if (p >= 20) return { label: "Early Stage", color: "#d97706", light: "#fef3c7", ring: "#fcd34d" };
        return { label: "Getting Started", color: "#6b7280", light: "#f3f4f6", ring: "#d1d5db" };
    }

    function parseFeatures(t) {
        if (!t) return [];
        return t.split(',').map(f => f.trim()).filter(Boolean);
    }

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}.sk{animation:pulse 1.2s ease-in-out infinite;background:#f1f5f9;border-radius:6px;}`}</style>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
                    <div className="sk" style={{ height: 20, width: '60%' }} />
                    <div className="sk" style={{ height: 14, width: '80%' }} />
                    <div className="sk" style={{ height: 14, width: '45%' }} />
                </div>
            </div>
        );
    }

    const status = getStatus();
    const completed = parseFeatures(aiContext?.completed_features);
    const pending = parseFeatures(aiContext?.pending_features);

    const R = 54, C = 2 * Math.PI * R;
    const dash = (progressAnim / 100) * C;

    const suggestions = [
        "What has been built so far?",
        "Is the project on track?",
        "What features are still pending?",
        "Explain the latest changes"
    ];
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
        <div style={s.root}>
            <style>{globalCss}</style>

            {/* ── LEFT SIDEBAR ── */}
            <aside style={s.sidebar}>
                <button onClick={() => navigate('/dashboard')} style={s.backLink} className="back-link">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>

                <div style={s.sideProject}>
                    <div style={s.projectInitial}>{(project?.name || 'P')[0].toUpperCase()}</div>
                    <div>
                        <div style={s.projectTitle}>{project?.name}</div>
                        <div style={{ ...s.statusChip, background: status.light, color: status.color, border: `1px solid ${status.ring}` }}>
                            {status.label}
                        </div>
                    </div>
                </div>

                {/* Circular progress */}
                <div style={s.ringWrap}>
                    <svg width="128" height="128" viewBox="0 0 128 128">
                        <circle cx="64" cy="64" r={R} fill="none" stroke="#f1f5f9" strokeWidth="10" />
                        <circle cx="64" cy="64" r={R} fill="none" stroke={status.color} strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={`${dash} ${C}`}
                            strokeDashoffset={C / 4}
                            style={{ transition: 'stroke-dasharray 0.05s linear' }}
                        />
                    </svg>
                    <div style={s.ringLabel}>
                        <div style={{ ...s.ringPct, color: status.color }}>{progressAnim}%</div>
                        <div style={s.ringSub}>complete</div>
                    </div>
                </div>

                <div style={s.statsRow}>
                    <div style={s.statBox}>
                        <div style={{ ...s.statNum, color: '#16a34a' }}>{completed.length}</div>
                        <div style={s.statLab}>Shipped</div>
                    </div>
                    <div style={s.statDivider} />
                    <div style={s.statBox}>
                        <div style={{ ...s.statNum, color: '#d97706' }}>{pending.length}</div>
                        <div style={s.statLab}>Pending</div>
                    </div>
                    <div style={s.statDivider} />
                    <div style={s.statBox}>
                        <div style={{ ...s.statNum, color: '#2563eb' }}>{weeklyActivity.length}</div>
                        <div style={s.statLab}>Commits</div>
                    </div>
                </div>

                {aiContext?.estimated_timeline && (
                    <div style={s.etaBadge}>
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="9"/><path strokeLinecap="round" d="M12 7v5l3 3"/>
                        </svg>
                        Est. {aiContext.estimated_timeline}
                    </div>
                )}

                <nav style={s.nav}>
                    {[
                        { key: 'overview', label: 'Overview', icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
                        { key: 'activity', label: 'Activity', icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
                        { key: 'chat', label: 'Ask AI', icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg> },
                    ].map(({ key, label, icon }) => (
                        <button key={key} onClick={() => setActiveTab(key)}
                            style={{ ...s.navItem, ...(activeTab === key ? s.navActive : {}) }}
                            className="nav-item">
                            {icon}
                            <span>{label}</span>
                            {activeTab === key && <div style={{ ...s.navIndicator, background: status.color }} />}
                        </button>
                    ))}
                </nav>

                <button onClick={() => setShowInviteModal(true)} style={s.inviteBtn}>
                    + Invite Member
                </button>

                <button onClick={refreshData} disabled={refreshing} style={s.syncBtn} className="sync-btn">
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                        style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                    {refreshing ? 'Syncing…' : 'Sync commits'}
                </button>
            </aside>

            {showInviteModal && (
                <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
                    <div style={{background:"#fff",borderRadius:16,padding:28,width:"100%",maxWidth:380,boxShadow:"0 8px 40px rgba(0,0,0,0.18)"}}>
                        <h2 style={{margin:"0 0 20px",fontSize:18,fontWeight:800,color:"#111827"}}>Invite Member</h2>
                        <label style={{fontSize:12,fontWeight:600,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.05em"}}>Name</label>
                        <input type="text" value={memberName} onChange={e=>setMemberName(e.target.value)} placeholder="Enter their name"
                            style={{width:"100%",margin:"8px 0 16px",border:"1px solid #e5e7eb",borderRadius:9,padding:"10px 13px",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}} />
                        <label style={{fontSize:12,fontWeight:600,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.05em"}}>Role</label>
                        <div style={{display:"flex",gap:8,margin:"8px 0 20px"}}>
                            <button onClick={()=>setMemberRole("client")} style={{flex:1,padding:"9px",borderRadius:9,border:"1.5px solid",borderColor:memberRole==="client"?"#2563eb":"#e5e7eb",background:memberRole==="client"?"#eff6ff":"#f8fafc",color:memberRole==="client"?"#2563eb":"#6b7280",fontWeight:600,fontSize:13,cursor:"pointer"}}>Client</button>
                            <button onClick={()=>setMemberRole("freelancer")} style={{flex:1,padding:"9px",borderRadius:9,border:"1.5px solid",borderColor:memberRole==="freelancer"?"#2563eb":"#e5e7eb",background:memberRole==="freelancer"?"#eff6ff":"#f8fafc",color:memberRole==="freelancer"?"#2563eb":"#6b7280",fontWeight:600,fontSize:13,cursor:"pointer"}}>Freelancer</button>
                        </div>
                        <div style={{display:"flex",gap:8}}>
                            <button onClick={()=>{setShowInviteModal(false);setMemberName("");setMemberRole("");}} style={{flex:1,padding:"10px",borderRadius:9,border:"1px solid #e5e7eb",background:"#f8fafc",fontSize:13,fontWeight:600,color:"#6b7280",cursor:"pointer"}}>Cancel</button>
                            <button onClick={inviteMember} style={{flex:1,padding:"10px",borderRadius:9,border:"none",background:"#16a34a",fontSize:13,fontWeight:600,color:"#fff",cursor:"pointer"}}>Invite</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MAIN CONTENT ── */}
            <main style={s.main}>

                {activeTab === 'overview' && (
                    <div style={s.tabContent} className="tab-in">
                        <div style={s.contentHeader}>
                            <h2 style={s.contentTitle}>Features</h2>
                            <span style={s.contentSub}>{completed.length + pending.length} total features tracked</span>
                        </div>

                        <div style={s.bigTrack}>
                            <div style={{ ...s.bigFill, width: `${progressAnim}%`, background: status.color }} />
                            <div style={{ ...s.bigHandle, left: `${progressAnim}%`, borderColor: status.color }} />
                        </div>
                        <div style={s.trackLabels}>
                            <span style={s.trackLab}>0%</span>
                            <span style={{ ...s.trackLab, color: status.color, fontWeight: 700 }}>{progressAnim}% done</span>
                            <span style={s.trackLab}>100%</span>
                        </div>

                        <div style={s.featureCols}>
                            <div style={s.featureCol}>
                                <div style={s.colLabel}>
                                    <div style={{ ...s.colDot, background: '#16a34a' }} />
                                    Shipped — {completed.length}
                                </div>
                                <div style={s.featureList}>
                                    {completed.length === 0
                                        ? <p style={s.emptyMsg}>Nothing shipped yet</p>
                                        : completed.map((f, i) => (
                                            <div key={i} style={s.featureItem} className="f-item">
                                                <div style={{ ...s.fIcon, background: '#dcfce7' }}>
                                                    <svg width="10" height="10" fill="none" stroke="#16a34a" strokeWidth="3" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                                                    </svg>
                                                </div>
                                                <span style={s.fText}>{f}</span>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>

                            <div style={s.colSep} />

                            <div style={s.featureCol}>
                                <div style={s.colLabel}>
                                    <div style={{ ...s.colDot, background: '#d97706' }} />
                                    In Queue — {pending.length}
                                </div>
                                <div style={s.featureList}>
                                    {pending.length === 0
                                        ? <p style={s.emptyMsg}>All done! 🎉</p>
                                        : pending.map((f, i) => (
                                            <div key={i} style={{ ...s.featureItem, opacity: 0.7 }} className="f-item">
                                                <div style={{ ...s.fIcon, background: '#fef3c7' }}>
                                                    <svg width="10" height="10" fill="none" stroke="#d97706" strokeWidth="2.5" viewBox="0 0 24 24">
                                                        <circle cx="12" cy="12" r="9"/>
                                                    </svg>
                                                </div>
                                                <span style={{ ...s.fText, color: '#9ca3af' }}>{f}</span>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div style={s.tabContent} className="tab-in">
                        <div style={s.contentHeader}>
                            <h2 style={s.contentTitle}>Commit Activity</h2>
                            <span style={s.contentSub}>Last 7 commits</span>
                        </div>
                        {weeklyActivity.length === 0
                            ? <div style={s.bigEmpty}><p style={s.emptyMsg}>No commits yet</p></div>
                            : (
                                <div style={s.commitList}>
                                    {weeklyActivity.map((commit, idx) => (
                                        <div key={idx} style={s.commitRow} className="commit-row">
                                            <div style={s.commitLeft}>
                                                <div style={{ ...s.commitNum, color: status.color }}>{String(idx + 1).padStart(2, '0')}</div>
                                                {idx < weeklyActivity.length - 1 && <div style={s.commitLine} />}
                                            </div>
                                            <div style={s.commitBody}>
                                                <div style={s.commitMeta}>
                                                    <span style={s.commitMessage}>{commit.message}</span>
                                                    <span style={s.commitDate}>
                                                        {new Date(commit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>
                                                {commit.ai_explanation && (
                                                    <p style={s.commitExpl}>{commit.ai_explanation}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        }
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div style={{ ...s.tabContent, display: 'flex', flexDirection: 'column', height: '100%', maxWidth: 780 }} className="tab-in">
                        <div style={s.contentHeader}>
                            <h2 style={s.contentTitle}>Ask AI</h2>
                            <span style={s.contentSub}>Ask anything about this project</span>
                        </div>

                        {/* Chat messages */}
                        <div style={s.chatBox}>
                            {chatHistory.length === 0 ? (
                                <div style={s.chatEmpty}>
                                    <div style={s.chatEmptyIcon}>💬</div>
                                    <p style={s.chatEmptyTitle}>Ask me anything about this project</p>
                                    <p style={s.chatEmptySub}>I know the full context — commits, progress, features.</p>
                                    <div style={s.suggestions}>
                                        {suggestions.map(q => (
                                            <button key={q} onClick={() => setQuestion(q)} style={s.suggestion} className="suggestion-btn">
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div style={s.messageList}>
                                    {chatHistory.map((chat, i) => (
                                        <div key={i} style={s.messagePair}>
                                            <div style={s.userBubbleWrap}>
                                                <div style={s.userBubble}>{chat.question}</div>
                                            </div>
                                            <div style={s.aiBubbleWrap}>
                                                <div style={s.aiBadge}>AI</div>
                                                {chat.answer === null ? (
                                                    <div style={s.aiBubble}>Thinking…</div>
                                                ) : (
                                                    <div style={s.aiBubble}>{formatAIMessage(chat.answer)}</div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div style={s.chatInputRow}>
                            <input
                                type="text"
                                value={question}
                                onChange={e => setQuestion(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !chatLoading && askAI()}
                                placeholder="Ask anything about this project..."
                                disabled={chatLoading}
                                style={s.chatInput}
                                className="chat-input"
                            />
                            <button
                                onClick={askAI}
                                disabled={chatLoading || !question.trim()}
                                style={s.sendBtn}
                                className="send-btn"
                            >
                                {chatLoading ? '…' : (
                                    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

const s = {
    root: { display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Sora', 'DM Sans', sans-serif" },
    sidebar: { width: 260, flexShrink: 0, background: '#ffffff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', padding: '20px 16px', gap: 16, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' },
    backLink: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', letterSpacing: '0.03em', textTransform: 'uppercase', width: 'fit-content' },
    sideProject: { display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #f1f5f9', paddingBottom: 16 },
    projectInitial: { width: 36, height: 36, borderRadius: 10, background: '#111827', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flexShrink: 0 },
    projectTitle: { fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4, lineHeight: 1.2 },
    statusChip: { display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, letterSpacing: '0.04em', textTransform: 'uppercase' },
    ringWrap: { position: 'relative', width: 128, height: 128, margin: '0 auto' },
    ringLabel: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
    ringPct: { fontSize: 26, fontWeight: 800, lineHeight: 1, letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums' },
    ringSub: { fontSize: 10, color: '#9ca3af', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' },
    statsRow: { display: 'flex', alignItems: 'center', background: '#f8fafc', borderRadius: 10, padding: '10px 0' },
    statBox: { flex: 1, textAlign: 'center' },
    statNum: { fontSize: 20, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
    statLab: { fontSize: 10, color: '#9ca3af', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 2 },
    statDivider: { width: 1, height: 28, background: '#e5e7eb' },
    etaBadge: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 10px', fontWeight: 500 },
    nav: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
    navItem: { display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#6b7280', textAlign: 'left', position: 'relative', transition: 'background 0.12s, color 0.12s' },
    navActive: { background: '#f8fafc', color: '#111827', fontWeight: 700 },
    navIndicator: { position: 'absolute', right: 10, width: 6, height: 6, borderRadius: '50%' },
    syncBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#111827', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.01em', transition: 'background 0.15s' },
    inviteBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s', marginBottom: 8 },
    main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' },
    tabContent: { flex: 1, padding: '40px 48px', maxWidth: 780 },
    contentHeader: { marginBottom: 32 },
    contentTitle: { margin: '0 0 4px', fontSize: 28, fontWeight: 800, color: '#111827', letterSpacing: '-0.7px' },
    contentSub: { fontSize: 13, color: '#9ca3af', fontWeight: 500 },
    bigTrack: { width: '100%', height: 6, background: '#f1f5f9', borderRadius: 99, position: 'relative', marginBottom: 10 },
    bigFill: { height: '100%', borderRadius: 99, transition: 'width 0.05s linear' },
    bigHandle: { position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)', width: 14, height: 14, borderRadius: '50%', background: '#fff', border: '3px solid', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', transition: 'left 0.05s linear' },
    trackLabels: { display: 'flex', justifyContent: 'space-between', marginBottom: 32 },
    trackLab: { fontSize: 11, color: '#9ca3af', fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
    featureCols: { display: 'flex', gap: 0 },
    featureCol: { flex: 1 },
    colSep: { width: 1, background: '#f1f5f9', margin: '0 32px' },
    colLabel: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 },
    colDot: { width: 8, height: 8, borderRadius: '50%' },
    featureList: { display: 'flex', flexDirection: 'column', gap: 4 },
    featureItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, transition: 'background 0.1s' },
    fIcon: { width: 20, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    fText: { fontSize: 13, color: '#374151', fontWeight: 500, lineHeight: 1.4 },
    emptyMsg: { margin: 0, fontSize: 13, color: '#d1d5db', padding: '16px 10px' },
    commitList: { display: 'flex', flexDirection: 'column' },
    commitRow: { display: 'flex', gap: 20 },
    commitLeft: { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 32 },
    commitNum: { fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em', lineHeight: '44px', flexShrink: 0 },
    commitLine: { flex: 1, width: 1, background: '#f1f5f9', minHeight: 16 },
    commitBody: { flex: 1, padding: '10px 0 24px', borderBottom: '1px solid #f8fafc' },
    commitMeta: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 6 },
    commitMessage: { fontSize: 14, fontWeight: 700, color: '#111827', lineHeight: 1.4, letterSpacing: '-0.2px' },
    commitDate: { fontSize: 11, color: '#9ca3af', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 },
    commitExpl: { margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.65 },
    bigEmpty: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 },

    // Chat styles
    chatBox: { flex: 1, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px', marginBottom: 16, overflowY: 'auto', minHeight: 340, maxHeight: 440 },
    chatEmpty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '0 20px' },
    chatEmptyIcon: { fontSize: 32, marginBottom: 12 },
    chatEmptyTitle: { margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#111827' },
    chatEmptySub: { margin: '0 0 20px', fontSize: 13, color: '#9ca3af' },
    suggestions: { display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 400 },
    suggestion: { background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#374151', cursor: 'pointer', textAlign: 'left', fontWeight: 500, fontFamily: 'inherit', transition: 'background 0.1s, border-color 0.1s' },
    messageList: { display: 'flex', flexDirection: 'column', gap: 16 },
    messagePair: { display: 'flex', flexDirection: 'column', gap: 8 },
    userBubbleWrap: { display: 'flex', justifyContent: 'flex-end' },
    userBubble: { background: '#111827', color: '#fff', borderRadius: '14px 14px 3px 14px', padding: '10px 14px', fontSize: 13, maxWidth: '75%', lineHeight: 1.5, fontWeight: 500 },
    aiBubbleWrap: { display: 'flex', gap: 8, alignItems: 'flex-start' },
    aiBadge: { width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0, marginTop: 2 },
    aiBubble: { background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '3px 14px 14px 14px', padding: '10px 14px', fontSize: 13, maxWidth: '75%', lineHeight: 1.6, color: '#111827' },
    chatInputRow: { display: 'flex', gap: 10 },
    chatInput: { flex: 1, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#111827', outline: 'none', fontFamily: 'inherit' },
    sendBtn: { width: 44, height: 44, borderRadius: 10, background: '#111827', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 },
};

const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .tab-in { animation: tabIn 0.22s cubic-bezier(0.22,1,0.36,1) both; }
  @keyframes tabIn { from { opacity:0; transform:translateX(10px); } to { opacity:1; transform:translateX(0); } }
  .back-link:hover { color: #111827 !important; }
  .nav-item:hover { background: #f8fafc !important; color: #374151 !important; }
  .sync-btn:hover { background: #1f2937 !important; }
  .f-item:hover { background: #f8fafc !important; }
  .suggestion-btn:hover { background: #eff6ff !important; border-color: #93c5fd !important; }
  .chat-input:focus { border-color: #2563eb !important; background: #fff !important; }
  .send-btn:hover:not(:disabled) { background: #1f2937 !important; }
  .send-btn:disabled { background: #e5e7eb !important; cursor: not-allowed; }
`;
