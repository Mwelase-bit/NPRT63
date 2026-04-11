const { useState } = React;

const RegistrationModal = ({ gameState }) => {
    const [mode, setMode] = useState('register'); // 'register' or 'login'
    const [step, setStep] = useState(1); // step 1: name, step 2: faculty, step 3: credentials
    const [name, setName] = useState('');
    const [selectedFaculty, setSelectedFaculty] = useState(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const faculties = window.SPU_FACULTIES;

    const handleNameNext = () => {
        if (!name.trim() || name.trim().length < 2) {
            setError('Please enter your name (at least 2 characters).');
            return;
        }
        setError('');
        setStep(2);
    };

    const handleFacultyNext = () => {
        if (!selectedFaculty) {
            setError('Please select your faculty to continue.');
            return;
        }
        setError('');
        setStep(3);
    };

    const handleRegister = async () => {
        if (!email.trim() || !email.includes('@')) {
            setError('Please enter a valid email address.');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            await gameState.register({
                name: name.trim(),
                faculty: selectedFaculty,
                email: email.trim(),
                password: password
            });
            // Success - modal will close
        } catch (err) {
            setError(err.message || 'Registration failed. Please try again.');
            setIsSubmitting(false);
        }
    };

    const handleLogin = async () => {
        if (!email.trim() || !password) {
            setError('Please enter both email and password.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            await gameState.login({
                email: email.trim(),
                password: password
            });
            // Success - modal will close
        } catch (err) {
            setError(err.message || 'Login failed. Invalid email or password.');
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, backdropFilter: 'blur(8px)'
        }}>
            <div style={{
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '16px',
                padding: '40px',
                maxWidth: '520px',
                width: '90%',
                boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
                color: 'white',
                fontFamily: "'Inter', sans-serif"
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>🏰</div>
                    <h2 style={{ margin: 0, fontSize: '1.8em', fontWeight: 700, letterSpacing: '-0.5px' }}>
                        Welcome to BUILDHAUS
                    </h2>
                    <p style={{ margin: '8px 0 0', opacity: 0.65, fontSize: '0.95em' }}>
                        Sol Plaatje University · Gamified Focus Platform
                    </p>
                </div>

                {/* Step Indicator (Only for Register) */}
                {mode === 'register' && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '30px' }}>
                        {[1, 2, 3].map(s => (
                            <div key={s} style={{
                                width: s === step ? '32px' : '10px',
                                height: '10px',
                                borderRadius: '5px',
                                background: s === step ? '#4CAF50' : s < step ? '#4CAF50' : 'rgba(255,255,255,0.2)',
                                transition: 'all 0.3s ease'
                            }} />
                        ))}
                    </div>
                )}

                {mode === 'register' && step === 1 && (
                    <div>
                        <h3 style={{ margin: '0 0 8px', fontSize: '1.1em' }}>What's your name?</h3>
                        <p style={{ margin: '0 0 16px', opacity: 0.6, fontSize: '0.9em' }}>
                            This is how you'll appear on faculty leaderboards.
                        </p>
                        <input
                            type="text"
                            value={name}
                            onChange={e => { setName(e.target.value); setError(''); }}
                            onKeyDown={e => e.key === 'Enter' && handleNameNext()}
                            placeholder="e.g. Musa Mazibuko"
                            autoFocus
                            style={{
                                width: '100%', padding: '14px 16px',
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '10px', color: 'white',
                                fontSize: '1em', boxSizing: 'border-box',
                                outline: 'none'
                            }}
                        />
                        {error && <p style={{ color: '#ff6b6b', fontSize: '0.85em', margin: '8px 0 0' }}>{error}</p>}
                        <button
                            onClick={handleNameNext}
                            style={{
                                marginTop: '20px', width: '100%', padding: '14px',
                                background: 'linear-gradient(135deg, #4CAF50, #45a049)',
                                border: 'none', borderRadius: '10px',
                                color: 'white', fontSize: '1em', fontWeight: 600,
                                cursor: 'pointer', letterSpacing: '0.5px'
                            }}
                        >
                            Next →
                        </button>
                    </div>
                )}

                {mode === 'register' && step === 2 && (
                    <div>
                        <h3 style={{ margin: '0 0 8px', fontSize: '1.1em' }}>Select your Faculty</h3>
                        <p style={{ margin: '0 0 20px', opacity: 0.6, fontSize: '0.9em' }}>
                            You'll be grouped with fellow students from your faculty.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                            {faculties.map(faculty => (
                                <button
                                    key={faculty.id}
                                    onClick={() => { setSelectedFaculty(faculty.id); setError(''); }}
                                    style={{
                                        padding: '18px 12px',
                                        background: selectedFaculty === faculty.id
                                            ? `linear-gradient(135deg, ${faculty.color}55, ${faculty.color}33)`
                                            : 'rgba(255,255,255,0.05)',
                                        border: selectedFaculty === faculty.id
                                            ? `2px solid ${faculty.color}`
                                            : '2px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px', color: 'white',
                                        cursor: 'pointer', textAlign: 'center',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div style={{ fontSize: '26px', marginBottom: '8px' }}>{faculty.emoji}</div>
                                    <div style={{ fontSize: '0.8em', fontWeight: 600, lineHeight: 1.3 }}>
                                        {faculty.shortName}
                                    </div>
                                </button>
                            ))}
                        </div>
                        {selectedFaculty && (
                            <p style={{ textAlign: 'center', fontSize: '0.85em', opacity: 0.7, margin: '0 0 12px' }}>
                                {faculties.find(f => f.id === selectedFaculty)?.name}
                            </p>
                        )}
                        {error && <p style={{ color: '#ff6b6b', fontSize: '0.85em', margin: '0 0 12px', textAlign: 'center' }}>{error}</p>}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => { setStep(1); setError(''); }}
                                style={{
                                    flex: '0 0 auto', padding: '14px 20px',
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    borderRadius: '10px', color: 'white',
                                    cursor: 'pointer', fontSize: '1em'
                                }}
                            >
                                ← Back
                            </button>
                            <button
                                onClick={handleFacultyNext}
                                style={{
                                    flex: 1, padding: '14px',
                                    background: 'linear-gradient(135deg, #4CAF50, #45a049)',
                                    border: 'none', borderRadius: '10px',
                                    color: 'white', fontSize: '1em', fontWeight: 600,
                                    cursor: 'pointer', letterSpacing: '0.5px'
                                }}
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                )}

                {(mode === 'login' || (mode === 'register' && step === 3)) && (
                    <div>
                        <h3 style={{ margin: '0 0 8px', fontSize: '1.1em' }}>
                            {mode === 'login' ? 'Welcome back!' : 'Create your account'}
                        </h3>
                        <p style={{ margin: '0 0 20px', opacity: 0.6, fontSize: '0.9em' }}>
                            {mode === 'login' ? 'Enter your credentials to continue.' : 'Use your SPU email and a secure password.'}
                        </p>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: '5px', display: 'block' }}>Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => { setEmail(e.target.value); setError(''); }}
                                placeholder="e.g. student@spu.ac.za"
                                style={{
                                    width: '100%', padding: '12px 14px',
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '8px', color: 'white',
                                    fontSize: '1em', boxSizing: 'border-box',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: '5px', display: 'block' }}>Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => { setPassword(e.target.value); setError(''); }}
                                onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleRegister())}
                                placeholder="Min. 6 characters"
                                style={{
                                    width: '100%', padding: '12px 14px',
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '8px', color: 'white',
                                    fontSize: '1em', boxSizing: 'border-box',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        {error && <p style={{ color: '#ff6b6b', fontSize: '0.85em', margin: '0 0 15px', textAlign: 'center' }}>{error}</p>}

                        <div style={{ display: 'flex', gap: '10px' }}>
                            {mode === 'register' && (
                                <button
                                    onClick={() => { setStep(2); setError(''); }}
                                    disabled={isSubmitting}
                                    style={{
                                        flex: '0 0 auto', padding: '14px 20px',
                                        background: 'rgba(255,255,255,0.08)',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        borderRadius: '10px', color: 'white',
                                        cursor: isSubmitting ? 'default' : 'pointer', fontSize: '1em',
                                        opacity: isSubmitting ? 0.5 : 1
                                    }}
                                >
                                    ← Back
                                </button>
                            )}
                            <button
                                onClick={mode === 'login' ? handleLogin : handleRegister}
                                disabled={isSubmitting}
                                style={{
                                    flex: 1, padding: '14px',
                                    background: 'linear-gradient(135deg, #4CAF50, #45a049)',
                                    border: 'none', borderRadius: '10px',
                                    color: 'white', fontSize: '1em', fontWeight: 600,
                                    cursor: isSubmitting ? 'default' : 'pointer', letterSpacing: '0.5px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                    opacity: isSubmitting ? 0.8 : 1
                                }}
                            >
                                {isSubmitting ? (mode === 'login' ? 'Logging in...' : 'Registering...') : (mode === 'login' ? '🔑 Log In' : '🏰 Start Building')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Mode Toggle Footer */}
                <div style={{ marginTop: '25px', textAlign: 'center', fontSize: '0.9em', opacity: 0.8 }}>
                    {mode === 'register' ? (
                        <>
                            Already have an account?{' '}
                            <button
                                onClick={() => { setMode('login'); setError(''); }}
                                style={{
                                    background: 'none', border: 'none', color: '#4CAF50',
                                    fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline'
                                }}
                            >
                                Log in
                            </button>
                        </>
                    ) : (
                        <>
                            Don't have an account?{' '}
                            <button
                                onClick={() => { setMode('register'); setError(''); }}
                                style={{
                                    background: 'none', border: 'none', color: '#4CAF50',
                                    fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline'
                                }}
                            >
                                Register
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

window.RegistrationModal = RegistrationModal;
