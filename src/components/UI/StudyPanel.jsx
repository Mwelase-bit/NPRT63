// StudyPanel.jsx — AI-powered flashcard generator, viewer & quiz mode
// Runs ALONGSIDE the focus timer — never interrupts it.
const { useState, useEffect, useCallback, useRef } = React;

const StudyPanel = ({ currentUser, apiBase = '' }) => {
    // ── View state ────────────────────────────────────────────────────────────
    const [view, setView] = useState('library'); // 'library' | 'generate' | 'study' | 'quiz' | 'quiz-results'

    // ── Library (saved sets) ──────────────────────────────────────────────────
    const [sets, setSets]           = useState([]);
    const [loadingSets, setLoadingSets] = useState(false);

    // ── Generate form ─────────────────────────────────────────────────────────
    const [inputText, setInputText]   = useState('');
    const [title, setTitle]           = useState('');
    const [subject, setSubject]       = useState('');
    const [cardCount, setCardCount]   = useState(8);
    const [generating, setGenerating] = useState(false);
    const [genError, setGenError]     = useState('');

    // ── Study mode ────────────────────────────────────────────────────────────
    const [activeSet, setActiveSet]   = useState(null); // { set, cards }
    const [loadingSet, setLoadingSet] = useState(false);
    const [cardIndex, setCardIndex]   = useState(0);
    const [flipped, setFlipped]       = useState(false);
    const [toastMsg, setToastMsg]     = useState('');

    // ── Quiz mode ─────────────────────────────────────────────────────────────
    const [quizSetId, setQuizSetId]       = useState(null);
    const [quizTitle, setQuizTitle]       = useState('');
    const [quizQuestions, setQuizQuestions] = useState([]);
    const [quizIndex, setQuizIndex]       = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null); // index chosen
    const [answeredMap, setAnsweredMap]   = useState({}); // { [qIndex]: chosenIndex }
    const [showExplanation, setShowExplanation] = useState(false);
    const [quizScore, setQuizScore]       = useState(0);
    const [quizGenerating, setQuizGenerating] = useState(false);
    const [quizError, setQuizError]       = useState('');
    const [quizResult, setQuizResult]     = useState(null); // { coinsEarned, percentage, message }
    const [quizHistory, setQuizHistory]   = useState([]);

    const toastTimer = useRef(null);

    // ─── Auth header ──────────────────────────────────────────────────────────
    const authHeaders = useCallback(() => {
        const token = localStorage.getItem('buildersFocus_token');
        return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    }, []);

    // ─── Toast helper ─────────────────────────────────────────────────────────
    const showToast = (msg) => {
        setToastMsg(msg);
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToastMsg(''), 3500);
    };

    // ─── Load saved sets ──────────────────────────────────────────────────────
    // Use a ref for the token so loadSets doesn't need authHeaders in its
    // dependency array — prevents re-firing on every parent re-render (timer tick).
    const hasLoadedRef = useRef(false);

    const loadSets = useCallback(async () => {
        setLoadingSets(true);
        try {
            const res = await fetch(`${apiBase}/api/ai/flashcards`, { headers: authHeaders() });
            const data = await res.json();
            if (res.ok) setSets(data.sets || []);
        } catch (e) {
            console.error('Load sets error:', e);
        } finally {
            setLoadingSets(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiBase]); // intentionally exclude authHeaders — it reads localStorage directly

    useEffect(() => {
        if (currentUser && !hasLoadedRef.current) {
            hasLoadedRef.current = true;
            loadSets();
        }
    }, [currentUser, loadSets]);

    // ─── Generate flashcards ──────────────────────────────────────────────────
    const handleGenerate = async (e) => {
        e.preventDefault();
        if (!inputText.trim() || inputText.trim().length < 20) {
            setGenError('Please paste at least 20 characters of study content.');
            return;
        }
        setGenError('');
        setGenerating(true);
        try {
            const res = await fetch(`${apiBase}/api/ai/flashcards`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    text:      inputText.trim(),
                    title:     title.trim()   || 'My Flashcard Set',
                    subject:   subject.trim() || 'General',
                    cardCount
                })
            });
            const data = await res.json();
            if (!res.ok) {
                setGenError(data.error || 'Failed to generate flashcards.');
                return;
            }
            showToast(data.message);
            // Load the new set straight into study mode
            setActiveSet({ set: { title: title || 'My Flashcard Set', subject: subject || 'General' }, cards: data.cards });
            setCardIndex(0);
            setFlipped(false);
            setView('study');
            // Reset form
            setInputText('');
            setTitle('');
            setSubject('');
            // Refresh library in background
            loadSets();
        } catch (err) {
            setGenError('Network error — please check your connection.');
        } finally {
            setGenerating(false);
        }
    };

    // ─── Open a saved set ─────────────────────────────────────────────────────
    const openSet = async (setId) => {
        setLoadingSet(true);
        try {
            const res = await fetch(`${apiBase}/api/ai/flashcards/${setId}`, { headers: authHeaders() });
            const data = await res.json();
            if (res.ok) {
                setActiveSet(data);
                setCardIndex(0);
                setFlipped(false);
                setView('study');
            }
        } catch (e) {
            console.error('Open set error:', e);
        } finally {
            setLoadingSet(false);
        }
    };

    // ─── Delete a set ─────────────────────────────────────────────────────────
    const deleteSet = async (setId, e) => {
        e.stopPropagation();
        if (!confirm('Delete this flashcard set?')) return;
        try {
            await fetch(`${apiBase}/api/ai/flashcards/${setId}`, {
                method: 'DELETE',
                headers: authHeaders()
            });
            setSets(prev => prev.filter(s => s.id !== setId));
            showToast('Set deleted.');
        } catch (e) {
            console.error('Delete error:', e);
        }
    };

    // ─── Card navigation ──────────────────────────────────────────────────────
    const cards = activeSet?.cards || [];
    const totalCards = cards.length;

    const nextCard = () => { setFlipped(false); setCardIndex(i => Math.min(i + 1, totalCards - 1)); };
    const prevCard = () => { setFlipped(false); setCardIndex(i => Math.max(i - 1, 0)); };

    // ─── Start a quiz from a set ──────────────────────────────────────────────
    const startQuiz = async (setId, setTitle, questionCount = 5) => {
        setQuizError('');
        setQuizGenerating(true);
        try {
            const res = await fetch(`${apiBase}/api/ai/quiz`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ setId, questionCount })
            });
            const data = await res.json();
            if (!res.ok) { setQuizError(data.error || 'Failed to generate quiz.'); setQuizGenerating(false); return; }
            setQuizSetId(setId);
            setQuizTitle(data.setTitle || setTitle);
            setQuizQuestions(data.questions);
            setQuizIndex(0);
            setAnsweredMap({});
            setSelectedAnswer(null);
            setShowExplanation(false);
            setQuizScore(0);
            setQuizResult(null);
            setView('quiz');
        } catch (e) {
            setQuizError('Network error — please check your connection.');
        } finally {
            setQuizGenerating(false);
        }
    };

    // ─── Select an answer for current quiz question ───────────────────────────
    const handleSelectAnswer = (optionIndex) => {
        if (answeredMap[quizIndex] !== undefined) return; // already answered
        const correct = quizQuestions[quizIndex]?.answer === optionIndex;
        setSelectedAnswer(optionIndex);
        setAnsweredMap(prev => ({ ...prev, [quizIndex]: optionIndex }));
        setShowExplanation(true);
        if (correct) setQuizScore(s => s + 1);
    };

    // ─── Move to next question or finish quiz ─────────────────────────────────
    const handleNextQuestion = () => {
        if (quizIndex < quizQuestions.length - 1) {
            setQuizIndex(i => i + 1);
            setSelectedAnswer(answeredMap[quizIndex + 1] ?? null);
            setShowExplanation(answeredMap[quizIndex + 1] !== undefined);
        } else {
            submitQuizResult();
        }
    };

    // ─── Submit score to backend ──────────────────────────────────────────────
    const submitQuizResult = async () => {
        const total = quizQuestions.length;
        try {
            const res = await fetch(`${apiBase}/api/ai/quiz/attempt`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ setId: quizSetId, score: quizScore, total })
            });
            const data = await res.json();
            if (res.ok) {
                setQuizResult(data);
                showToast(data.message);
            }
        } catch (e) { console.error('Submit quiz error:', e); }
        setView('quiz-results');
    };

    // ─── Retry quiz with the same set ────────────────────────────────────────
    const retryQuiz = () => startQuiz(quizSetId, quizTitle, quizQuestions.length);

    // ─── Keyboard support ─────────────────────────────────────────────────────
    useEffect(() => {
        if (view !== 'study') return;
        const handler = (e) => {
            if (e.key === 'ArrowRight') nextCard();
            if (e.key === 'ArrowLeft')  prevCard();
            if (e.key === ' ')          { e.preventDefault(); setFlipped(f => !f); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [view, totalCards]);

    // ─── Format date ──────────────────────────────────────────────────────────
    const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="study-panel">
            {/* Toast */}
            {toastMsg && (
                <div className="study-toast">
                    {toastMsg}
                </div>
            )}

            {/* Header */}
            <div className="study-header">
                <div className="study-header-left">
                    <div>
                        <h2 className="study-title">AI Study</h2>
                        <p className="study-subtitle">Flashcards powered by LLaMA 3</p>
                    </div>
                </div>
                <div className="study-timer-badge">
                    <span className="timer-dot"></span>
                    Focus timer keeps running
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="study-tabs">
                <button
                    className={`study-tab ${view === 'library'  ? 'active' : ''}`}
                    onClick={() => setView('library')}
                >
                    Library
                </button>
                <button
                    className={`study-tab ${view === 'generate' ? 'active' : ''}`}
                    onClick={() => setView('generate')}
                >
                    ✨ Generate
                </button>
                {view === 'study' && (
                    <button className="study-tab active">Study</button>
                )}
                {(view === 'quiz' || view === 'quiz-results') && (
                    <button className="study-tab active">🧠 Quiz</button>
                )}
            </div>

            {/* ── Library View ── */}
            {view === 'library' && (
                <div className="study-library">
                    {loadingSets ? (
                        <div className="study-loading">
                            <div className="study-spinner"></div>
                            <p>Loading your sets…</p>
                        </div>
                    ) : sets.length === 0 ? (
                        <div className="study-empty">
                            <div className="study-empty-icon study-empty-icon-text">[ ]</div>
                            <h3>No flashcard sets yet</h3>
                            <p>Paste your lecture notes and let AI do the hard work!</p>
                            <button className="btn-study-primary" onClick={() => setView('generate')}>
                                ✨ Generate My First Set
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="study-library-header">
                                <span className="study-set-count">{sets.length} saved set{sets.length !== 1 ? 's' : ''}</span>
                                <button className="btn-study-primary btn-sm" onClick={() => setView('generate')}>
                                    + New Set
                                </button>
                            </div>
                            <div className="study-sets-grid">
                                {sets.map(s => (
                                    <div key={s.id} className="study-set-card" onClick={() => openSet(s.id)}>
                                        <div className="study-set-subject">{s.subject}</div>
                                        <div className="study-set-title">{s.title}</div>
                                        <div className="study-set-meta">
                                            <span>{s.cardCount} cards</span>
                                            <span>{fmtDate(s.createdAt)}</span>
                                        </div>
                                        <div className="study-set-footer">
                                            <span className="study-set-coins">+{s.coinsEarned} coins earned</span>
                                            <div className="study-set-actions">
                                                <button
                                                    className="study-set-quiz-btn"
                                                    onClick={(e) => { e.stopPropagation(); startQuiz(s.id, s.title); }}
                                                    title="Take a quiz on this set"
                                                    disabled={quizGenerating}
                                                >
                                                    {quizGenerating && quizSetId === s.id ? '...' : '🧠 Quiz'}
                                                </button>
                                                <button
                                                    className="study-set-delete"
                                                    onClick={(e) => deleteSet(s.id, e)}
                                                    title="Delete set"
                                                >✕</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Generate View ── */}
            {view === 'generate' && (
                <form className="study-generate" onSubmit={handleGenerate}>
                    <div className="study-form-row">
                        <div className="study-form-group">
                            <label className="study-label">Set Title</label>
                            <input
                                className="study-input"
                                type="text"
                                placeholder="e.g. Chapter 3: Cell Biology"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                maxLength={100}
                            />
                        </div>
                        <div className="study-form-group">
                            <label className="study-label">Subject</label>
                            <input
                                className="study-input"
                                type="text"
                                placeholder="e.g. Biology, Law, Maths"
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                maxLength={50}
                            />
                        </div>
                    </div>

                    <div className="study-form-group">
                        <label className="study-label">
                            Paste Your Notes / Lecture Content
                            <span className="study-char-count">{inputText.length}/8000</span>
                        </label>
                        <textarea
                            className="study-textarea"
                            placeholder="Paste your lecture notes, textbook sections, or any study material here…"
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            maxLength={8000}
                            rows={8}
                        />
                    </div>

                    <div className="study-form-group">
                        <label className="study-label">
                            Number of Flashcards: <strong>{cardCount}</strong>
                        </label>
                        <input
                            className="study-slider"
                            type="range"
                            min={3}
                            max={15}
                            value={cardCount}
                            onChange={e => setCardCount(parseInt(e.target.value))}
                        />
                        <div className="study-slider-labels">
                            <span>3</span><span>Quick Review</span><span>15</span>
                        </div>
                    </div>

                    {genError && (
                        <div className="study-error">⚠️ {genError}</div>
                    )}

                    <button
                        className="btn-study-primary btn-full"
                        type="submit"
                        disabled={generating}
                    >
                        {generating ? (
                            <>
                                <span className="study-spinner-inline"></span>
                                AI is thinking…
                            </>
                        ) : (
                            <>✨ Generate Flashcards (+10 coins)</>
                        )}
                    </button>
                    <p className="study-hint">Your focus timer keeps running while AI generates your cards.</p>
                </form>
            )}

            {/* ── Study / Flashcard Viewer ── */}
            {view === 'study' && (
                <div className="study-viewer">
                    {loadingSet ? (
                        <div className="study-loading">
                            <div className="study-spinner"></div>
                            <p>Loading cards…</p>
                        </div>
                    ) : activeSet && cards.length > 0 ? (
                        <>
                            <div className="study-viewer-header">
                                <button className="study-back-btn" onClick={() => setView('library')}>
                                    ← Library
                                </button>
                                <div className="study-viewer-meta">
                                    <span className="study-viewer-title">{activeSet.set?.title}</span>
                                    <span className="study-progress-badge">
                                        {cardIndex + 1} / {totalCards}
                                    </span>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="study-progress-bar">
                                <div
                                    className="study-progress-fill"
                                    style={{ width: `${((cardIndex + 1) / totalCards) * 100}%` }}
                                />
                            </div>

                            {/* Flashcard */}
                            <div
                                className={`flashcard-container ${flipped ? 'flipped' : ''}`}
                                onClick={() => setFlipped(f => !f)}
                                tabIndex={0}
                                onKeyDown={e => e.key === 'Enter' && setFlipped(f => !f)}
                            >
                                <div className="flashcard-inner">
                                    <div className="flashcard-face flashcard-front">
                                        <div className="flashcard-label">QUESTION</div>
                                        <div className="flashcard-text">{cards[cardIndex]?.front}</div>
                                        <div className="flashcard-hint">Click to reveal answer</div>
                                    </div>
                                    <div className="flashcard-face flashcard-back">
                                        <div className="flashcard-label flashcard-label-answer">ANSWER</div>
                                        <div className="flashcard-text">{cards[cardIndex]?.back}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="study-nav">
                                <button
                                    className="study-nav-btn"
                                    onClick={prevCard}
                                    disabled={cardIndex === 0}
                                >
                                    ← Prev
                                </button>
                                <button
                                    className="study-flip-btn"
                                    onClick={() => setFlipped(f => !f)}
                                >
                                    {flipped ? 'Hide Answer' : 'Reveal Answer'}
                                </button>
                                <button
                                    className="study-nav-btn"
                                    onClick={nextCard}
                                    disabled={cardIndex === totalCards - 1}
                                >
                                    Next →
                                </button>
                            </div>

                            <p className="study-keyboard-hint">
                                ← → Arrow keys to navigate &nbsp;·&nbsp; Space to flip
                            </p>

                            {/* Completion banner */}
                            {cardIndex === totalCards - 1 && (
                                <div className="study-complete-banner">
                                    You've reviewed all {totalCards} cards!
                                    <button className="study-restart-btn" onClick={() => { setCardIndex(0); setFlipped(false); }}>
                                        Restart
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="study-empty">
                            <p>No cards to display.</p>
                            <button className="btn-study-primary" onClick={() => setView('library')}>← Back</button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Quiz View ── */}
            {view === 'quiz' && quizQuestions.length > 0 && (() => {
                const q = quizQuestions[quizIndex];
                const answered = answeredMap[quizIndex] !== undefined;
                const chosen   = answeredMap[quizIndex];
                const correct  = q.answer;
                const total    = quizQuestions.length;
                const pct      = Math.round(((quizIndex + (answered ? 1 : 0)) / total) * 100);
                return (
                    <div className="quiz-viewer">
                        {/* Header */}
                        <div className="study-viewer-header">
                            <button className="study-back-btn" onClick={() => setView('library')}>← Library</button>
                            <div className="study-viewer-meta">
                                <span className="study-viewer-title">{quizTitle}</span>
                                <span className="study-progress-badge">{quizIndex + 1} / {total}</span>
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div className="study-progress-bar">
                            <div className="study-progress-fill quiz-progress-fill" style={{ width: `${pct}%` }} />
                        </div>

                        {/* Score tracker */}
                        <div className="quiz-score-row">
                            <span className="quiz-score-label">Score</span>
                            <span className="quiz-score-value">{quizScore} / {Object.keys(answeredMap).length}</span>
                        </div>

                        {/* Question */}
                        <div className="quiz-question-card">
                            <div className="quiz-q-label">QUESTION {quizIndex + 1}</div>
                            <div className="quiz-q-text">{q.question}</div>
                        </div>

                        {/* Options */}
                        <div className="quiz-options">
                            {q.options.map((opt, i) => {
                                let cls = 'quiz-option';
                                if (answered) {
                                    if (i === correct)       cls += ' quiz-option-correct';
                                    else if (i === chosen)   cls += ' quiz-option-wrong';
                                    else                     cls += ' quiz-option-dim';
                                } else {
                                    cls += ' quiz-option-idle';
                                }
                                return (
                                    <button
                                        key={i}
                                        className={cls}
                                        onClick={() => handleSelectAnswer(i)}
                                        disabled={answered}
                                    >
                                        <span className="quiz-option-letter">{['A','B','C','D'][i]}</span>
                                        <span className="quiz-option-text">{opt}</span>
                                        {answered && i === correct && <span className="quiz-tick">✓</span>}
                                        {answered && i === chosen && i !== correct && <span className="quiz-cross">✗</span>}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Explanation */}
                        {showExplanation && (
                            <div className={`quiz-explanation ${answeredMap[quizIndex] === q.answer ? 'quiz-exp-correct' : 'quiz-exp-wrong'}`}>
                                <strong>{answeredMap[quizIndex] === q.answer ? '✓ Correct!' : '✗ Incorrect'}</strong>
                                {' — '}{q.explanation}
                            </div>
                        )}

                        {/* Next / Finish */}
                        {answered && (
                            <button className="btn-study-primary btn-full quiz-next-btn" onClick={handleNextQuestion}>
                                {quizIndex < total - 1 ? 'Next Question →' : '🏁 See Results'}
                            </button>
                        )}
                    </div>
                );
            })()}

            {/* ── Quiz Results View ── */}
            {view === 'quiz-results' && (
                <div className="quiz-results">
                    <div className="quiz-results-header">
                        <button className="study-back-btn" onClick={() => setView('library')}>← Library</button>
                        <span className="study-viewer-title">{quizTitle}</span>
                    </div>

                    {/* Score ring */}
                    <div className="quiz-results-body">
                        <div className="quiz-ring-wrap">
                            <svg className="quiz-ring" viewBox="0 0 120 120">
                                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10"/>
                                <circle
                                    cx="60" cy="60" r="52" fill="none"
                                    stroke={quizResult?.percentage === 100 ? '#4ade80' : quizResult?.percentage >= 80 ? '#818cf8' : quizResult?.percentage >= 60 ? '#fbbf24' : '#f87171'}
                                    strokeWidth="10"
                                    strokeLinecap="round"
                                    strokeDasharray={`${2 * Math.PI * 52}`}
                                    strokeDashoffset={`${2 * Math.PI * 52 * (1 - (quizResult?.percentage ?? 0) / 100)}`}
                                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 1s ease' }}
                                />
                            </svg>
                            <div className="quiz-ring-label">
                                <span className="quiz-ring-pct">{quizResult?.percentage ?? 0}%</span>
                                <span className="quiz-ring-sub">{quizScore} / {quizQuestions.length} correct</span>
                            </div>
                        </div>

                        <div className="quiz-result-msg">
                            {quizResult?.percentage === 100 && '🏆 Perfect Score! Incredible!'}
                            {quizResult?.percentage >= 80 && quizResult?.percentage < 100 && '🌟 Great work! Almost perfect!'}
                            {quizResult?.percentage >= 60 && quizResult?.percentage < 80 && '👍 Good job! Keep practising!'}
                            {quizResult?.percentage >= 40 && quizResult?.percentage < 60 && '📚 Keep studying — you\'ll get there!'}
                            {quizResult?.percentage < 40 && '💪 Don\'t give up! Review your flashcards.'}
                        </div>

                        {quizResult?.coinsEarned > 0 && (
                            <div className="quiz-coins-badge">
                                🪙 +{quizResult.coinsEarned} coins earned!
                            </div>
                        )}

                        <div className="quiz-results-actions">
                            <button className="btn-study-primary" onClick={retryQuiz} disabled={quizGenerating}>
                                {quizGenerating ? '⏳ Generating…' : '🔄 Try Again'}
                            </button>
                            <button className="study-nav-btn" onClick={() => setView('study')}>
                                📖 Review Cards
                            </button>
                            <button className="study-nav-btn" onClick={() => setView('library')}>
                                ← Library
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

window.StudyPanel = StudyPanel;
