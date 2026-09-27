const { useState } = React;

const RegistrationModal = ({ gameState }) => {
    const [mode, setMode] = useState('register');
    const [step, setStep] = useState(1); // step 1: name, step 2: faculty, step 3: credentials
    const [name, setName] = useState('');
    const [selectedFaculty, setSelectedFaculty] = useState(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const faculties = window.SPU_FACULTIES || [
        { id: 'nas', name: 'Natural and Applied Sciences', shortName: 'NAS', emoji: '🔬', color: '#4CAF50' },
        { id: 'edu', name: 'Education', shortName: 'EDU', emoji: '📚', color: '#2196F3' },
        { id: 'ems', name: 'Economic and Management Sciences', shortName: 'EMS', emoji: '📈', color: '#FF9800' },
        { id: 'hum', name: 'Humanities', shortName: 'HUM', emoji: '🎭', color: '#9C27B0' }
    ];

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
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>🏰</div>
                    <h2 style={{ margin: 0, fontSize: '1.8em', fontWeight: 700, letterSpacing: '-0.5px' }}>
                        Welcome to BUILDHAUS
                    </h2>
                    <p style={{ margin: '8px 0 0', opacity: 0.65, fontSize: '0.95em' }}>
                        Sol Plaatje University · Gamified Focus Platform
                    </p>
                </div>

                <div>
                    <h3 style={{ margin: '0 0 8px', fontSize: '1.1em' }}>Create your account</h3>
                    <p style={{ margin: '0 0 20px', opacity: 0.6, fontSize: '0.9em' }}>
                        Complete the form below to register.
                    </p>
                    
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: '5px', display: 'block' }}>Display Name</label>
                        <input type="text" placeholder="e.g. Musa Mazibuko" style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'white' }} />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: '5px', display: 'block' }}>Faculty</label>
                        <select style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'white' }}>
                            <option value="">Select Faculty...</option>
                            <option value="nas">Natural and Applied Sciences</option>
                            <option value="edu">Education</option>
                            <option value="ems">Economic and Management Sciences</option>
                            <option value="hum">Humanities</option>
                        </select>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: '5px', display: 'block' }}>Email Address</label>
                        <input type="email" placeholder="e.g. student@spu.ac.za" style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'white' }} />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: '5px', display: 'block' }}>Password</label>
                        <input type="password" placeholder="Min. 6 characters" style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'white' }} />
                    </div>

                    <button style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #4CAF50, #45a049)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '1em', fontWeight: 600, cursor: 'pointer' }}>
                        Register
                    </button>
                </div>
                
                <div style={{ marginTop: '25px', textAlign: 'center', fontSize: '0.9em', opacity: 0.8 }}>
                    Already have an account? <span style={{ color: '#4CAF50', textDecoration: 'underline' }}>Log in</span>
                </div>
            </div>
        </div>
    );
};

window.RegistrationModal = RegistrationModal;
