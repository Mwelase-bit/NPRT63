// AnalyticsPanel.jsx — "Insights": the student's own study analytics.
// Sessions, focus time, time spent in the app and sign-ins, over a date range
// they choose, with charts and plain-language takeaways.
const { useState, useEffect, useMemo, useRef } = React;

const AN_PRESETS = [
    { id: '7', label: '7 days', days: 7 },
    { id: '30', label: '30 days', days: 30 },
    { id: '90', label: '90 days', days: 90 },
    { id: '365', label: 'Year', days: 365 },
    { id: 'custom', label: 'Custom', days: null }
];

const AN_METRICS = {
    focus:    { label: 'Focus time',  color: '#4f9dff', color2: '#22d3b8', field: 'focusSeconds', kind: 'time' },
    sessions: { label: 'Sessions',    color: '#a78bfa', color2: '#f472b6', field: 'sessions',     kind: 'count', unit: 'session' },
    app:      { label: 'Time in app', color: '#fbbf24', color2: '#fb923c', field: 'appSeconds',   kind: 'time' },
    visits:   { label: 'Visits',      color: '#34d399', color2: '#38bdf8', field: 'visits',       kind: 'count', unit: 'visit' }
};

const anLocalDay = (d = new Date()) => d.toLocaleDateString('en-CA');          // YYYY-MM-DD in the student's time zone
const anAddDays = (key, n) => new Date(Date.parse(key + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const anShortDate = (key) => new Date(key + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// 5400 → "1h 30m"; 45 → "45s"; 0 → "0m"
const anDuration = (sec) => {
    sec = Math.max(0, Math.round(sec || 0));
    if (sec === 0) return '0m';
    if (sec < 60) return `${sec}s`;
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    if (h === 0) return `${m}m`;
    return m === 60 ? `${h + 1}h` : `${h}h ${String(m).padStart(2, '0')}m`;
};

const anDelta = (cur, prev) => {
    if (!prev && !cur) return null;
    if (!prev) return { text: 'New', dir: 'up' };
    const pct = Math.round(((cur - prev) / prev) * 100);
    if (pct === 0) return { text: 'No change', dir: 'flat' };
    return { text: `${pct > 0 ? '+' : ''}${pct}%`, dir: pct > 0 ? 'up' : 'down' };
};

// Round the top of the axis to a friendly number and return evenly spaced ticks.
// Time axes (in minutes) step by whole 5/10/15/30 minutes or whole hours.
const AN_TIME_STEPS = [5, 10, 15, 30, 60, 120, 180, 240, 360, 480, 720, 1440];
const anNiceScale = (max, unitSec) => {
    const base = unitSec ? max / unitSec : max;            // values in minutes (or counts)
    if (base <= 0) return { top: unitSec ? 30 : 1, ticks: unitSec ? [0, 15, 30] : [0, 1] };
    const rough = base / 4;
    let step;
    if (unitSec) {
        step = AN_TIME_STEPS.find(s => s >= rough) || 1440;
    } else {
        const mag = Math.pow(10, Math.floor(Math.log10(rough)));
        step = [1, 2, 5, 10].map(m => m * mag).find(s => s >= rough);
        step = Math.max(1, Math.round(step));              // counts are whole numbers
    }
    const top = Math.ceil(base / step) * step;
    const ticks = [];
    for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
    return { top, ticks };
};

const anAxisLabel = (v, kind) => {
    if (kind === 'count') return String(v);
    return v >= 60 ? `${+(v / 60).toFixed(1)}h` : `${v}m`;
};

const AnIcon = ({ name, size = 18, color }) => <window.FeatherIcon name={name} size={size} gap={0} color={color} />;

// ── Bar chart ────────────────────────────────────────────────────────────────
const AnBarChart = ({ rows, metric }) => {
    const [hover, setHover] = useState(null);
    const m = AN_METRICS[metric];
    const W = 720, H = 260, padL = 44, padR = 12, padT = 14, padB = 30;
    const iw = W - padL - padR, ih = H - padT - padB;

    // Long ranges are grouped by week so the bars stay readable
    const buckets = useMemo(() => {
        if (rows.length <= 45) return rows.map(r => ({ label: anShortDate(r.date), start: r.date, end: r.date, v: r[m.field] }));
        const out = [];
        for (let i = 0; i < rows.length; i += 7) {
            const chunk = rows.slice(i, i + 7);
            out.push({
                label: anShortDate(chunk[0].date), start: chunk[0].date, end: chunk[chunk.length - 1].date,
                v: chunk.reduce((n, r) => n + r[m.field], 0)
            });
        }
        return out;
    }, [rows, metric]);

    const unitSec = m.kind === 'time' ? 60 : 0;
    const max = Math.max(...buckets.map(b => b.v), 0);
    const { top, ticks } = anNiceScale(max, unitSec);
    const toVal = (v) => (unitSec ? v / unitSec : v);
    const y = (v) => padT + ih - (toVal(v) / top) * ih;
    const bw = iw / buckets.length;
    const barW = Math.max(2, Math.min(34, bw * 0.68));
    const avg = buckets.length ? buckets.reduce((n, b) => n + b.v, 0) / buckets.length : 0;
    const labelEvery = Math.ceil(buckets.length / 8);
    const fmt = (v) => (m.kind === 'time' ? anDuration(v) : `${v} ${m.unit}${v === 1 ? '' : 's'}`);
    const gid = `an-grad-${metric}`;
    const active = hover !== null ? buckets[hover] : null;

    return (
        <div className="an-chart-wrap">
            <svg viewBox={`0 0 ${W} ${H}`} className="an-chart" role="img"
                 aria-label={`${m.label} per ${rows.length > 45 ? 'week' : 'day'}`}
                 onMouseLeave={() => setHover(null)}>
                <defs>
                    <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor={m.color} />
                        <stop offset="1" stopColor={m.color2} />
                    </linearGradient>
                </defs>
                {ticks.map(t => (
                    <g key={t}>
                        <line x1={padL} x2={W - padR} y1={padT + ih - (t / top) * ih} y2={padT + ih - (t / top) * ih}
                              stroke="rgba(255,255,255,0.12)" strokeDasharray={t === 0 ? '' : '3 4'} />
                        <text x={padL - 8} y={padT + ih - (t / top) * ih + 4} textAnchor="end" className="an-axis">{anAxisLabel(t, m.kind)}</text>
                    </g>
                ))}
                {max > 0 && (
                    <g>
                        <line x1={padL} x2={W - padR} y1={y(avg)} y2={y(avg)} stroke="#fff" strokeOpacity="0.55" strokeDasharray="6 5" />
                    </g>
                )}
                {buckets.map((b, i) => {
                    const x = padL + i * bw + (bw - barW) / 2;
                    const h = Math.max(b.v > 0 ? 3 : 0, (toVal(b.v) / top) * ih);
                    return (
                        <g key={b.start} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
                            <rect x={padL + i * bw} y={padT} width={bw} height={ih} fill="transparent" />
                            <rect x={x} y={padT + ih - h} width={barW} height={h} rx={Math.min(5, barW / 2)}
                                  fill={`url(#${gid})`} opacity={hover === null || hover === i ? 1 : 0.45}>
                                <title>{`${b.start === b.end ? anShortDate(b.start) : anShortDate(b.start) + ' – ' + anShortDate(b.end)}: ${fmt(b.v)}`}</title>
                            </rect>
                            {i % labelEvery === 0 && (
                                <text x={x + barW / 2} y={H - 9} textAnchor="middle" className="an-axis">{b.label}</text>
                            )}
                        </g>
                    );
                })}
            </svg>
            <div className="an-tooltip" aria-live="polite">
                {active
                    ? <><strong>{active.start === active.end ? anShortDate(active.start) : `${anShortDate(active.start)} – ${anShortDate(active.end)}`}</strong> · {fmt(active.v)}</>
                    : <span>{max === 0 ? 'Nothing recorded in these dates yet.' : <>Dashed line = your average ({fmt(Math.round(avg))} per {rows.length > 45 ? 'week' : 'day'}). Hover or tap a bar for details.</>}</span>}
            </div>
        </div>
    );
};

// ── When you focus best (24 hours) ───────────────────────────────────────────
const AnHourChart = ({ byHour }) => {
    const W = 360, H = 130, padB = 22;
    const max = Math.max(...byHour.map(h => h.focusSeconds), 0);
    const peak = max > 0 ? byHour.findIndex(h => h.focusSeconds === max) : -1;
    const bw = W / 24;
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="an-hours" role="img" aria-label="Focus time by hour of the day">
            {byHour.map((h, i) => {
                const bh = max ? Math.max(h.focusSeconds ? 3 : 0, (h.focusSeconds / max) * (H - padB - 8)) : 0;
                return (
                    <rect key={i} x={i * bw + 2} y={H - padB - bh} width={bw - 4} height={bh} rx="3"
                          fill={i === peak ? '#22d3b8' : '#4f9dff'} opacity={i === peak ? 1 : 0.55}>
                        <title>{`${String(i).padStart(2, '0')}:00 – ${anDuration(h.focusSeconds)}`}</title>
                    </rect>
                );
            })}
            <line x1="0" x2={W} y1={H - padB} y2={H - padB} stroke="rgba(255,255,255,0.2)" />
            {[0, 6, 12, 18].map(h => (
                <text key={h} x={h * bw + 2} y={H - 6} className="an-axis">{String(h).padStart(2, '0')}:00</text>
            ))}
            <text x={W - 2} y={H - 6} textAnchor="end" className="an-axis">24:00</text>
        </svg>
    );
};

// ── Outcomes donut ───────────────────────────────────────────────────────────
const AnDonut = ({ completed, interrupted }) => {
    const total = completed + interrupted;
    const R = 46, C = 2 * Math.PI * R;
    const frac = total ? completed / total : 0;
    return (
        <svg viewBox="0 0 120 120" className="an-donut" role="img"
             aria-label={`${completed} completed and ${interrupted} interrupted sessions`}>
            <circle cx="60" cy="60" r={R} fill="none" stroke={total ? '#f87171' : 'rgba(255,255,255,0.15)'} strokeWidth="14" />
            {total > 0 && (
                <circle cx="60" cy="60" r={R} fill="none" stroke="#34d399" strokeWidth="14" strokeLinecap="butt"
                        strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 60 60)" />
            )}
            <text x="60" y="58" textAnchor="middle" className="an-donut-num">{total ? `${Math.round(frac * 100)}%` : '–'}</text>
            <text x="60" y="76" textAnchor="middle" className="an-donut-sub">completed</text>
        </svg>
    );
};

// ── Stat card ────────────────────────────────────────────────────────────────
const AnCard = ({ icon, color, label, value, sub, delta }) => (
    <div className="an-card">
        <div className="an-card-icon" style={{ background: color + '26', color }}><AnIcon name={icon} size={18} /></div>
        <div className="an-card-body">
            <div className="an-card-label">{label}</div>
            <div className="an-card-value">{value}</div>
            <div className="an-card-sub">
                {delta && <span className={`an-delta an-${delta.dir}`}>{delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '•'} {delta.text}</span>}
                {sub && <span>{sub}</span>}
            </div>
        </div>
    </div>
);

// ── The panel ────────────────────────────────────────────────────────────────
const AnalyticsPanel = ({ gameState }) => {
    const token = gameState?.token;
    const [preset, setPreset] = useState('30');
    const [customFrom, setCustomFrom] = useState(() => anAddDays(anLocalDay(), -13));
    const [customTo, setCustomTo] = useState(() => anLocalDay());
    const [metric, setMetric] = useState('focus');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const reqId = useRef(0);

    const today = anLocalDay();
    const { from, to, rangeError } = useMemo(() => {
        if (preset === 'custom') {
            if (!customFrom || !customTo) return { from: null, to: null, rangeError: 'Pick a start and an end date.' };
            if (customFrom > customTo) return { from: null, to: null, rangeError: 'The start date must be before the end date.' };
            if (customTo > today) return { from: null, to: null, rangeError: 'The end date cannot be in the future.' };
            if ((Date.parse(customTo) - Date.parse(customFrom)) / 86400000 > 365) return { from: null, to: null, rangeError: 'Please pick a range of up to one year.' };
            return { from: customFrom, to: customTo, rangeError: '' };
        }
        const days = AN_PRESETS.find(p => p.id === preset).days;
        return { from: anAddDays(today, -(days - 1)), to: today, rangeError: '' };
    }, [preset, customFrom, customTo, today]);

    useEffect(() => {
        if (!token || !from) return;
        const id = ++reqId.current;
        setLoading(true);
        setError('');
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        window.api.analytics.get({ from, to, tz })
            .then(res => { if (id === reqId.current) setData(res); })
            .catch(err => { if (id === reqId.current) setError(err.message || 'Could not load your insights.'); })
            .finally(() => { if (id === reqId.current) setLoading(false); });
    }, [token, from, to]);

    const t = data?.totals;
    const prev = data?.previous;
    const days = data?.range?.days || 0;
    const hasData = !!t && (t.sessions > 0 || t.appSeconds > 0 || t.visits > 0);

    const bestHour = useMemo(() => {
        if (!data) return null;
        const max = Math.max(...data.byHour.map(h => h.focusSeconds));
        if (max <= 0) return null;
        const h = data.byHour.findIndex(x => x.focusSeconds === max);
        return `${String(h).padStart(2, '0')}:00 – ${String((h + 1) % 24).padStart(2, '0')}:00`;
    }, [data]);

    const insight = useMemo(() => {
        if (!t) return '';
        if (!hasData) return 'Nothing recorded for these dates yet. Start a focus session and your insights will appear here.';
        const parts = [];
        if (t.focusSeconds > 0) {
            const d = anDelta(t.focusSeconds, prev.focusSeconds);
            let s = `You focused for ${anDuration(t.focusSeconds)} over ${t.activeDays} active day${t.activeDays === 1 ? '' : 's'}`;
            if (d && d.dir === 'up' && d.text !== 'New') s += `, ${d.text.replace('+', '')} more than the previous ${days} days`;
            else if (d && d.dir === 'down') s += `, ${d.text.replace('-', '')} less than the previous ${days} days`;
            parts.push(s + '.');
        } else {
            parts.push(`You were active on ${t.activeDays} day${t.activeDays === 1 ? '' : 's'}, but finished no focus sessions yet.`);
        }
        if (bestHour) parts.push(`You focus best between ${bestHour}.`);
        if (t.successRate !== null && t.successRate < 60 && t.sessions >= 3) parts.push('Try a shorter session to build the habit, then grow it.');
        return parts.join(' ');
    }, [t, prev, hasData, bestHour, days]);

    const exportCsv = () => {
        if (!data) return;
        const lines = ['date,sessions,completed_sessions,focus_minutes,minutes_in_app,sign_ins,visits'];
        data.daily.forEach(d => lines.push([d.date, d.sessions, d.completed, Math.round(d.focusSeconds / 60),
            Math.round(d.appSeconds / 60), d.logins, d.visits].join(',')));
        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `buildhaus-insights-${data.range.from}_to_${data.range.to}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

    return (
        <div className="analytics-panel">
            <div className="an-header">
                <div>
                    <h2>Your Insights</h2>
                    <p className="an-subtitle">See how you study: sessions, focus time and time in BUILDHAUS.</p>
                </div>
                <button className="an-export" onClick={exportCsv} disabled={!data || !hasData} title="Download this range as a spreadsheet">
                    <AnIcon name="download" size={15} /> <span>Export CSV</span>
                </button>
            </div>

            <div className="an-filters" role="group" aria-label="Date range">
                {AN_PRESETS.map(p => (
                    <button key={p.id} className={`an-chip ${preset === p.id ? 'active' : ''}`} onClick={() => setPreset(p.id)}>
                        {p.label}
                    </button>
                ))}
                {preset === 'custom' && (
                    <div className="an-custom">
                        <label>From <input type="date" value={customFrom} max={today} onChange={e => setCustomFrom(e.target.value)} /></label>
                        <label>To <input type="date" value={customTo} max={today} onChange={e => setCustomTo(e.target.value)} /></label>
                    </div>
                )}
            </div>
            {rangeError && <div className="an-error" role="alert">{rangeError}</div>}
            {error && <div className="an-error" role="alert">{error}</div>}

            {!token && <div className="an-empty">Sign in to see your insights.</div>}

            {token && !data && loading && <div className="an-empty">Loading your insights…</div>}

            {token && data && (
                <div className={loading ? 'an-body an-loading' : 'an-body'}>
                    <div className="an-insight"><AnIcon name="zap" size={18} color="#fbbf24" /> <span>{insight}</span></div>

                    <div className="an-cards">
                        <AnCard icon="clock" color="#4f9dff" label="Focus time" value={anDuration(t.focusSeconds)}
                              delta={anDelta(t.focusSeconds, prev.focusSeconds)} sub={t.avgSessionSec ? `avg ${anDuration(t.avgSessionSec)} / session` : ''} />
                        <AnCard icon="layers" color="#a78bfa" label="Sessions" value={t.sessions}
                              delta={anDelta(t.sessions, prev.sessions)} sub={`${t.completed} completed · ${t.interrupted} interrupted`} />
                        <AnCard icon="monitor" color="#fbbf24" label="Time in app" value={anDuration(t.appSeconds)}
                              delta={anDelta(t.appSeconds, prev.appSeconds)} sub={t.activeDays ? `${anDuration(t.appSeconds / t.activeDays)} per active day` : ''} />
                        <AnCard icon="log-in" color="#34d399" label="Sign-ins" value={t.logins}
                              delta={anDelta(t.logins, prev.logins)} sub={`opened the app ${t.visits} time${t.visits === 1 ? '' : 's'}`} />
                        <AnCard icon="target" color="#f472b6" label="Success rate" value={t.successRate === null ? '–' : `${t.successRate}%`}
                              sub={t.longestSessionSec ? `longest ${anDuration(t.longestSessionSec)}` : 'finish a session to see this'} />
                        <AnCard icon="calendar" color="#38bdf8" label="Active days" value={`${t.activeDays}/${days}`}
                              sub={data.allTime.streak ? `🔥 ${data.allTime.streak}-day streak` : 'start a streak today'} />
                    </div>

                    <section className="an-section">
                        <div className="an-section-head">
                            <h3>Trends</h3>
                            <div className="an-tabs" role="tablist">
                                {Object.entries(AN_METRICS).map(([k, v]) => (
                                    <button key={k} role="tab" aria-selected={metric === k}
                                            className={`an-tab ${metric === k ? 'active' : ''}`} onClick={() => setMetric(k)}>{v.label}</button>
                                ))}
                            </div>
                        </div>
                        <AnBarChart rows={data.daily} metric={metric} />
                        {days > 45 && <p className="an-note">Showing one bar per week to keep things readable.</p>}
                    </section>

                    <div className="an-two">
                        <section className="an-section">
                            <h3>When you focus best</h3>
                            <AnHourChart byHour={data.byHour} />
                            <p className="an-note">{bestHour ? `Your peak is ${bestHour}. Plan your hardest work then.` : 'Finish a session to find your best time of day.'}</p>
                        </section>
                        <section className="an-section">
                            <h3>Session outcomes</h3>
                            <div className="an-outcomes">
                                <AnDonut completed={t.completed} interrupted={t.interrupted} />
                                <ul className="an-legend">
                                    <li><span className="an-dot" style={{ background: '#34d399' }}></span>Completed <strong>{t.completed}</strong></li>
                                    <li><span className="an-dot" style={{ background: '#f87171' }}></span>Interrupted <strong>{t.interrupted}</strong></li>
                                </ul>
                            </div>
                        </section>
                    </div>

                    <section className="an-section">
                        <h3>Recent sessions</h3>
                        {data.recent.length === 0
                            ? <p className="an-note">No sessions in these dates yet.</p>
                            : (
                                <div className="an-table" role="table">
                                    <div className="an-row an-head" role="row">
                                        <span>When</span><span>Studied</span><span>Planned</span><span>Result</span><span>Coins</span>
                                    </div>
                                    {data.recent.map(s => (
                                        <div className="an-row" role="row" key={s.id}>
                                            <span>{new Date(s.endedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                            <span>{anDuration(s.elapsedSec)}</span>
                                            <span>{anDuration(s.durationSec)}</span>
                                            <span><em className={`an-pill ${s.completed ? 'ok' : 'bad'}`}>{s.completed ? 'Completed' : 'Interrupted'}</em></span>
                                            <span>{s.coinsEarned ? `+${s.coinsEarned}` : '–'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                    </section>

                    <div className="an-alltime">
                        <strong>All time</strong>
                        <span>{data.allTime.sessions} sessions</span>
                        <span>{anDuration(data.allTime.focusSeconds)} focused</span>
                        <span>{anDuration(data.allTime.appSeconds)} in app</span>
                        <span>{data.allTime.logins} sign-ins</span>
                    </div>
                </div>
            )}
        </div>
    );
};

window.AnalyticsPanel = AnalyticsPanel;
